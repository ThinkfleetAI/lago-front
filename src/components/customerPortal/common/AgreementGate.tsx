import { Button } from '~/components/designSystem/Button'
import { Typography } from '~/components/designSystem/Typography'

interface AgreementGateProps {
  signingUrl?: string | null
}

export const AGREEMENT_GATE_TEST_ID = 'customer-portal-agreement-gate'

// Blocking gate shown in the customer portal until the white-label / SDK MSA is
// signed. Signing happens on the hosted gate page (signingUrl), which renders
// the agreement, records the signature, and collects a payment method.
const AgreementGate = ({ signingUrl }: AgreementGateProps) => {
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-lg border border-grey-300 bg-grey-100 p-12 text-center"
      data-test={AGREEMENT_GATE_TEST_ID}
    >
      <Typography variant="headline" color="grey700">
        Action required: sign your agreement
      </Typography>
      <Typography className="max-w-md" variant="body" color="grey600">
        Before you can access billing, invoices, and usage, please review and accept your
        Master Services &amp; White-Label / SDK Agreement. It only takes a minute and no
        login is required.
      </Typography>
      <Button
        variant="primary"
        size="large"
        disabled={!signingUrl}
        onClick={() => {
          if (signingUrl) {
            window.location.assign(signingUrl)
          }
        }}
      >
        Review &amp; Sign Agreement
      </Button>
    </div>
  )
}

export default AgreementGate
