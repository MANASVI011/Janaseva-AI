import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app import groq_provider
from app import main as service_main
from app.groq_provider import DISCLAIMER, ProviderError
from app.schemas import ApplicationAnalysisRequest

client = TestClient(service_main.app)
AUTH_HEADERS = {"X-Janaseva-AI-Service-Token": "synthetic-internal-token"}
SAMPLE_REQUEST = {
    "analysisLanguage": "en",
    "applicationReferenceId": "SYNTHETIC-REF-001",
    "serviceType": "INCOME_CERTIFICATE",
    "applicationDetails": {
        "applicationStatus": "DOCUMENTS_VERIFIED",
        "workflowStage": "FINAL_REVIEW",
        "annualFamilyIncome": 100000,
        "applicationPurpose": "Synthetic test purpose.",
    },
    "documents": [
        {
            "name": "Income declaration",
            "documentType": "INCOME_DECLARATION",
            "verificationStatus": "VERIFIED",
            "latestVersionStatus": "VERIFIED",
            "required": True,
        }
    ],
    "missingDocuments": [],
    "fieldVerification": {
        "status": "SUBMITTED",
        "outcome": "INFORMATION_SUPPORTED",
        "observations": "Synthetic test observation.",
        "checklistOutcomes": [{"item": "Residence confirmed", "outcome": "VERIFIED"}],
        "officerRemarks": "Synthetic test remarks.",
        "followUpRequirements": [],
    },
}
SAMPLE_ANALYSIS = {
    "summary": "The supplied synthetic record contains verified document and field data.",
    "missingInformation": [],
    "potentialInconsistencies": [],
    "documentObservations": ["The listed income declaration is verified."],
    "fieldVerificationObservations": ["The field report records a supported outcome."],
    "suggestedQuestions": [],
    "officerAttentionPoints": [],
    "disclaimer": DISCLAIMER,
}


@pytest.fixture(autouse=True)
def configure_internal_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(service_main, "AI_SERVICE_TOKEN", "synthetic-internal-token")


def test_missing_api_key_returns_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(groq_provider, "GROQ_API_KEY", None)

    response = client.get("/provider-status", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json()["status"] == "NOT_CONFIGURED"
    assert "api_key" not in response.text.lower()
    assert response.headers["cache-control"].startswith("no-store")


def test_configured_provider_does_not_probe_without_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    generate = Mock()
    monkeypatch.setattr(groq_provider, "GROQ_API_KEY", "synthetic-test-key")
    monkeypatch.setattr(groq_provider, "_generate", generate)

    response = client.get("/provider-status", headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json()["status"] == "CONFIGURED"
    assert response.headers["cache-control"].startswith("no-store")
    assert response.headers["pragma"] == "no-cache"
    assert response.headers["expires"] == "0"
    generate.assert_not_called()


def test_connectivity_check_returns_connected_only_after_provider_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    generate = Mock(return_value="OK")
    monkeypatch.setattr(groq_provider, "GROQ_API_KEY", "synthetic-test-key")
    monkeypatch.setattr(groq_provider, "_generate", generate)

    response = client.get(
        "/provider-status?check_connectivity=true",
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "CONNECTED"
    generate.assert_called_once()


def test_missing_api_key_blocks_analysis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(groq_provider, "GROQ_API_KEY", None)

    response = client.post("/analyze/application", json=SAMPLE_REQUEST, headers=AUTH_HEADERS)

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "NOT_CONFIGURED"


def test_ai_endpoints_require_internal_backend_authentication(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(service_main, "AI_SERVICE_TOKEN", None)

    response = client.get("/provider-status")

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "AI_SERVICE_AUTH_NOT_CONFIGURED"


def test_valid_structured_analysis_is_returned(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(groq_provider, "GROQ_API_KEY", "synthetic-test-key")
    monkeypatch.setattr(
        groq_provider,
        "_generate",
        lambda *_args, **_kwargs: json.dumps(SAMPLE_ANALYSIS),
    )

    response = client.post("/analyze/application", json=SAMPLE_REQUEST, headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.json() == SAMPLE_ANALYSIS


def test_official_sdk_receives_structured_json_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_client = Mock()
    mock_client.chat.completions.create.return_value.choices = [
        SimpleNamespace(
            message=SimpleNamespace(content=json.dumps(SAMPLE_ANALYSIS)),
        )
    ]
    monkeypatch.setattr(groq_provider, "GROQ_API_KEY", "synthetic-test-key")
    monkeypatch.setattr(groq_provider, "Groq", Mock(return_value=mock_client))

    result = groq_provider.analyze_application(
        ApplicationAnalysisRequest.model_validate(SAMPLE_REQUEST)
    )

    request = mock_client.chat.completions.create.call_args.kwargs
    assert result.summary == SAMPLE_ANALYSIS["summary"]
    assert request["model"] == "qwen/qwen3.8-27b"
    assert request["max_completion_tokens"] == 1024
    assert request["reasoning_effort"] == "none"
    assert request["reasoning_format"] == "hidden"
    assert request["response_format"]["type"] == "json_schema"
    assert request["response_format"]["json_schema"]["strict"] is True
    schema = request["response_format"]["json_schema"]["schema"]
    assert schema["required"] == list(schema["properties"])
    assert schema["additionalProperties"] is False
    assert schema["type"] == "object"
    assert "maxLength" not in json.dumps(schema)
    assert "minLength" not in json.dumps(schema)
    assert "maxItems" not in json.dumps(schema)
    mock_client.chat.completions.create.assert_called_once()
    mock_client.close.assert_called_once()


def test_groq_client_uses_40_second_timeout_and_disables_retries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    groq_client = Mock()
    monkeypatch.setattr(groq_provider, "GROQ_API_KEY", "synthetic-test-key")
    monkeypatch.setattr(groq_provider, "Groq", groq_client)

    groq_provider._client()

    assert groq_client.call_args.kwargs["timeout"] == 40
    assert groq_client.call_args.kwargs["max_retries"] == 0


def test_official_sdk_base_url_does_not_duplicate_openai_v1_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_client = Mock()
    groq_client = Mock(return_value=mock_client)
    monkeypatch.setattr(groq_provider, "GROQ_API_KEY", "synthetic-test-key")
    monkeypatch.setattr(
        groq_provider,
        "GROQ_API_BASE_URL",
        "https://api.groq.com/openai/v1",
    )
    monkeypatch.setattr(groq_provider, "Groq", groq_client)

    groq_provider._client()

    assert groq_client.call_args.kwargs["base_url"] == "https://api.groq.com"


def test_malformed_model_response_is_not_returned_as_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(groq_provider, "GROQ_API_KEY", "synthetic-test-key")
    monkeypatch.setattr(groq_provider, "_generate", lambda *_args, **_kwargs: "{}")

    response = client.post("/analyze/application", json=SAMPLE_REQUEST, headers=AUTH_HEADERS)

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "INVALID_MODEL_RESPONSE"


def test_provider_timeout_is_classified() -> None:
    error = groq_provider._provider_error(TimeoutError())

    assert error.code == "PROVIDER_TIMEOUT"
    assert error.http_status == 504


def test_provider_timeout_is_reported_without_success_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(groq_provider, "GROQ_API_KEY", "synthetic-test-key")
    monkeypatch.setattr(
        groq_provider,
        "_generate",
        Mock(side_effect=ProviderError("PROVIDER_TIMEOUT", 504)),
    )

    response = client.post("/analyze/application", json=SAMPLE_REQUEST, headers=AUTH_HEADERS)

    assert response.status_code == 504
    assert response.json()["detail"]["code"] == "PROVIDER_TIMEOUT"


def test_fastapi_deadline_is_reported_separately_from_provider_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def timeout(*_args: object, **_kwargs: object) -> None:
        raise TimeoutError

    monkeypatch.setattr(service_main.asyncio, "to_thread", timeout)

    response = client.post(
        "/analyze/application",
        json=SAMPLE_REQUEST,
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 504
    assert response.json()["detail"]["code"] == "FASTAPI_REQUEST_TIMEOUT"


def test_provider_rate_limit_is_classified() -> None:
    cause = Mock()
    cause.status_code = 429
    cause.response = Mock(headers={"retry-after": "37"})

    error = groq_provider._provider_error(cause)

    assert error.code == "RATE_LIMITED"
    assert error.http_status == 429
    assert error.retry_after_seconds == 37


@pytest.mark.parametrize(
    ("status_code", "expected_code"),
    [
        (400, "INVALID_REQUEST"),
        (401, "INVALID_CREDENTIALS"),
        (403, "ACCESS_DENIED"),
        (404, "MODEL_OR_ENDPOINT_NOT_FOUND"),
        (500, "PROVIDER_ERROR"),
    ],
)
def test_provider_http_categories_are_preserved(
    status_code: int,
    expected_code: str,
) -> None:
    error = groq_provider._provider_error(Mock(status_code=status_code))

    assert error.code == expected_code
    assert error.upstream_status == status_code


def test_provider_error_retains_sanitized_upstream_diagnostics() -> None:
    cause = Mock(
        status_code=400,
        response=Mock(
            json=Mock(
                return_value={
                    "error": {
                        "code": "invalid_request_error",
                        "type": "invalid_request_error",
                        "message": "Unsupported response option near Synthetic Applicant.",
                        "failed_generation": '{"summary":"Synthetic Applicant"}',
                    }
                }
            )
        ),
    )

    error = groq_provider._provider_error(
        cause,
        'Analyze this application information:\n{"applicantName":"Synthetic Applicant"}',
    )

    assert error.code == "INVALID_REQUEST"
    assert error.upstream_status == 400
    assert error.upstream_code == "invalid_request_error"
    assert error.upstream_message == "Unsupported response option near [redacted]."
    assert error.upstream_failed_generation == '{"summary":"[redacted]"}'


def test_upstream_model_error_is_reported_as_gateway_error_with_safe_status(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(groq_provider, "GROQ_API_KEY", "synthetic-test-key")
    monkeypatch.setattr(
        groq_provider,
        "_generate",
        Mock(
            side_effect=ProviderError(
                "MODEL_OR_ENDPOINT_NOT_FOUND",
                502,
                upstream_status=404,
            )
        ),
    )

    response = client.post(
        "/analyze/application",
        json=SAMPLE_REQUEST,
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 502
    assert response.json()["detail"] == {
        "code": "MODEL_OR_ENDPOINT_NOT_FOUND",
        "upstreamStatus": 404,
    }


def test_rate_limited_analysis_is_not_returned_as_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(groq_provider, "GROQ_API_KEY", "synthetic-test-key")
    rate_limit = ProviderError("RATE_LIMITED", 429, 37, 429)
    monkeypatch.setattr(
        groq_provider,
        "_generate",
        Mock(side_effect=rate_limit),
    )

    response = client.post("/analyze/application", json=SAMPLE_REQUEST, headers=AUTH_HEADERS)

    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "RATE_LIMITED"
    assert response.json()["detail"]["retryAfterSeconds"] == 37
    assert response.json()["detail"]["upstreamStatus"] == 429
    assert response.headers["retry-after"] == "37"


def test_kannada_analysis_prompt_uses_kannada_output_language(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    generate = Mock(return_value=json.dumps(SAMPLE_ANALYSIS))
    monkeypatch.setattr(groq_provider, "GROQ_API_KEY", "synthetic-test-key")
    monkeypatch.setattr(groq_provider, "_generate", generate)

    request_data = {**SAMPLE_REQUEST, "analysisLanguage": "kn"}
    groq_provider.analyze_application(ApplicationAnalysisRequest.model_validate(request_data))

    prompt = generate.call_args.args[0]
    assert "Write the summary and all findings in Kannada." in prompt


def test_request_schema_rejects_personal_identifier_fields() -> None:
    with pytest.raises(ValueError):
        ApplicationAnalysisRequest.model_validate(
            {**SAMPLE_REQUEST, "aadhaarNumber": "123456789012"}
        )


def test_application_payload_schema_accepts_only_minimal_fields() -> None:
    parsed = ApplicationAnalysisRequest.model_validate(SAMPLE_REQUEST)

    assert "aadhaarNumber" not in parsed.model_dump(by_alias=True)
    assert "address" not in parsed.model_dump(by_alias=True)
