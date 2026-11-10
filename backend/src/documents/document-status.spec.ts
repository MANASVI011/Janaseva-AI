import {
  ApplicationDocumentStatus,
  DocumentStatus,
} from '../generated/prisma/enums.js';
import {
  calculateApplicationDocumentStatus,
  type StatusDocument,
  type StatusRequirement,
} from './document-status.js';

const required: StatusRequirement[] = [
  { category: 'IDENTITY_PROOF', label: '', required: true },
  { category: 'RATION_CARD', label: '', required: true },
];
const optional: StatusRequirement = {
  category: 'CASTE_CERTIFICATE',
  label: '',
  required: false,
};

function document(
  category: StatusDocument['category'],
  status: DocumentStatus,
  requiredDocument = true,
): StatusDocument {
  return {
    category,
    label: '',
    required: requiredDocument,
    status,
    versions: status === DocumentStatus.MISSING ? [] : [{ status }],
  };
}

describe('calculateApplicationDocumentStatus', () => {
  it('does not count missing optional service documents as required', () => {
    const documents = [
      document('IDENTITY_PROOF', DocumentStatus.VERIFIED),
      document('RATION_CARD', DocumentStatus.VERIFIED),
    ];

    expect(
      calculateApplicationDocumentStatus(documents, [...required, optional]),
    ).toBe(ApplicationDocumentStatus.DOCUMENTS_VERIFIED);
  });

  it('keeps required missing documents incomplete', () => {
    expect(
      calculateApplicationDocumentStatus(
        [document('IDENTITY_PROOF', DocumentStatus.VERIFIED)],
        required,
      ),
    ).toBe(ApplicationDocumentStatus.DOCUMENTS_INCOMPLETE);
  });

  it('applies rejected and replacement precedence before incomplete or pending', () => {
    expect(
      calculateApplicationDocumentStatus(
        [
          document('IDENTITY_PROOF', DocumentStatus.REJECTED),
          document('RATION_CARD', DocumentStatus.MISSING),
        ],
        required,
      ),
    ).toBe(ApplicationDocumentStatus.DOCUMENTS_REJECTED);
    expect(
      calculateApplicationDocumentStatus(
        [
          document('IDENTITY_PROOF', DocumentStatus.REPLACEMENT_REQUESTED),
          document('RATION_CARD', DocumentStatus.PENDING_VERIFICATION),
        ],
        required,
      ),
    ).toBe(ApplicationDocumentStatus.DOCUMENTS_AWAITING_REPLACEMENT);
  });

  it('reports review pending when all required uploads are awaiting verification', () => {
    expect(
      calculateApplicationDocumentStatus(
        [
          document('IDENTITY_PROOF', DocumentStatus.PENDING_VERIFICATION),
          document('RATION_CARD', DocumentStatus.PENDING_VERIFICATION),
        ],
        required,
      ),
    ).toBe(ApplicationDocumentStatus.DOCUMENT_REVIEW_PENDING);
  });
});
