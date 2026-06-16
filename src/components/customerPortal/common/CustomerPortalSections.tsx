import AgreementGate from '~/components/customerPortal/common/AgreementGate'
import { useCustomerPortalData } from '~/components/customerPortal/common/hooks/useCustomerPortalData'
import useCustomerPortalNavigation from '~/components/customerPortal/common/hooks/useCustomerPortalNavigation'
import useCustomerPortalTranslate from '~/components/customerPortal/common/useCustomerPortalTranslate'
import PortalCustomerInfos from '~/components/customerPortal/PortalCustomerInfos'
import PortalInvoicesList from '~/components/customerPortal/PortalInvoicesList'
import UsageSection from '~/components/customerPortal/usage/UsageSection'
import WalletSection from '~/components/customerPortal/wallet/WalletSection'
import { Button } from '~/components/designSystem/Button'
import { Typography } from '~/components/designSystem/Typography'
import { PremiumIntegrationTypeEnum } from '~/generated/graphql'
import Logo from '~/public/images/logo/lago-logo-grey.svg'

export const CUSTOMER_PORTAL_SECTIONS_TEST_ID = 'customer-portal-sections'
export const CUSTOMER_PORTAL_SECTIONS_POWERED_BY_TEST_ID = 'customer-portal-sections-powered-by'

const CustomerPortalSections = () => {
  const { translate } = useCustomerPortalTranslate()

  const { data: portalData } = useCustomerPortalData()

  const { viewWallet, viewSubscription, viewEditInformation, viewPlans } =
    useCustomerPortalNavigation()

  const showPoweredBy = !portalData?.customerPortalOrganization?.premiumIntegrations?.includes(
    PremiumIntegrationTypeEnum.RemoveBrandingWatermark,
  )

  // White-label / SDK customers must sign the MSA before anything else is shown.
  if (portalData?.customerPortalUser?.mustSignAgreement) {
    return (
      <div className="flex flex-col gap-12" data-test={CUSTOMER_PORTAL_SECTIONS_TEST_ID}>
        <AgreementGate signingUrl={portalData.customerPortalUser.agreementSigningUrl} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-12" data-test={CUSTOMER_PORTAL_SECTIONS_TEST_ID}>
      <WalletSection viewWallet={viewWallet} />
      <UsageSection viewSubscription={viewSubscription} />

      <div className="flex items-center justify-between rounded-lg border border-grey-300 bg-grey-100 p-6">
        <div className="flex flex-col gap-1">
          <Typography variant="bodyHl" color="grey700">
            {translate('text_lago_portal_manage_plans_title')}
          </Typography>
          <Typography variant="caption" color="grey600">
            {translate('text_lago_portal_manage_plans_caption')}
          </Typography>
        </div>
        <Button variant="primary" onClick={viewPlans}>
          {translate('text_lago_portal_view_plans_button')}
        </Button>
      </div>

      <PortalCustomerInfos viewEditInformation={viewEditInformation} />
      <PortalInvoicesList />

      {showPoweredBy && (
        <div
          className="my-8 flex justify-center gap-2 md:hidden"
          data-test={CUSTOMER_PORTAL_SECTIONS_POWERED_BY_TEST_ID}
        >
          <Typography variant="body" color="grey600">
            {translate('text_6419c64eace749372fc72b03')}
          </Typography>

          <Logo width="40px" />
        </div>
      )}
    </div>
  )
}

export default CustomerPortalSections
