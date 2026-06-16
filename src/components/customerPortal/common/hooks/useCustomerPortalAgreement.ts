import { gql, useQuery } from '@apollo/client'
import { useParams } from 'react-router-dom'

import { useIsAuthenticated } from '~/hooks/auth/useIsAuthenticated'

// Raw Apollo query (no codegen dependency, matching the create-org precedent) so
// the new white-label fields are fetched at runtime without regenerating types.
const GET_CUSTOMER_PORTAL_AGREEMENT = gql`
  query getCustomerPortalAgreement {
    customerPortalUser {
      id
      mustSignAgreement
      agreementSigningUrl
    }
  }
`

export const useCustomerPortalAgreement = () => {
  const { token } = useParams()
  const { isPortalAuthenticated } = useIsAuthenticated()

  const { data, loading } = useQuery(GET_CUSTOMER_PORTAL_AGREEMENT, {
    fetchPolicy: 'cache-first',
    skip: !isPortalAuthenticated || !token,
  })

  const user = data?.customerPortalUser

  return {
    loading,
    mustSignAgreement: Boolean(user?.mustSignAgreement),
    agreementSigningUrl: (user?.agreementSigningUrl ?? null) as string | null,
  }
}
