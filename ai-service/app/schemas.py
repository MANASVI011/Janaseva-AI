from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
ObservationText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1200)
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ApplicationDetails(StrictModel):
    application_status: ShortText = Field(alias="applicationStatus")
    workflow_stage: ShortText = Field(alias="workflowStage")
    annual_family_income: int | None = Field(default=None, alias="annualFamilyIncome", ge=0)
    application_purpose: str | None = Field(
        default=None, alias="applicationPurpose", max_length=500
    )


class DocumentInput(StrictModel):
    name: ShortText
    document_type: ShortText = Field(alias="documentType")
    verification_status: ShortText = Field(alias="verificationStatus")
    latest_version_status: str | None = Field(
        default=None, alias="latestVersionStatus", max_length=60
    )
    required: bool


class ChecklistOutcome(StrictModel):
    item: ShortText
    outcome: ShortText


class FieldVerificationInput(StrictModel):
    status: ShortText
    outcome: str | None = Field(default=None, max_length=100)
    observations: ObservationText | None = None
    checklist_outcomes: list[ChecklistOutcome] = Field(
        default_factory=list, alias="checklistOutcomes", max_length=30
    )
    officer_remarks: ObservationText | None = Field(default=None, alias="officerRemarks")
    follow_up_requirements: list[ShortText] = Field(
        default_factory=list, alias="followUpRequirements", max_length=20
    )


class ApplicationAnalysisRequest(StrictModel):
    analysis_language: Literal["kn", "en"] = Field(alias="analysisLanguage")
    application_reference_id: ShortText = Field(alias="applicationReferenceId")
    service_type: ShortText = Field(alias="serviceType")
    application_details: ApplicationDetails = Field(alias="applicationDetails")
    documents: list[DocumentInput] = Field(default_factory=list, max_length=50)
    missing_documents: list[ShortText] = Field(
        default_factory=list, alias="missingDocuments", max_length=50
    )
    field_verification: FieldVerificationInput | None = Field(
        default=None, alias="fieldVerification"
    )


class ApplicationAnalysis(StrictModel):
    summary: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1200)]
    missing_information: list[ShortText] = Field(alias="missingInformation", max_length=8)
    potential_inconsistencies: list[ShortText] = Field(
        alias="potentialInconsistencies", max_length=8
    )
    document_observations: list[ShortText] = Field(alias="documentObservations", max_length=8)
    field_verification_observations: list[ShortText] = Field(
        alias="fieldVerificationObservations", max_length=8
    )
    suggested_questions: list[ShortText] = Field(alias="suggestedQuestions", max_length=8)
    officer_attention_points: list[ShortText] = Field(alias="officerAttentionPoints", max_length=8)
    disclaimer: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)
    ]


class ProviderStatus(StrictModel):
    provider: str
    model: str
    status: Literal["NOT_CONFIGURED", "CONFIGURED", "CONNECTED", "UNAVAILABLE"]
    reason: str | None = None
