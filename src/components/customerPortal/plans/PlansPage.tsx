import { gql } from '@apollo/client'
import { useMemo, useRef, useState } from 'react'

import useCustomerPortalNavigation from '~/components/customerPortal/common/hooks/useCustomerPortalNavigation'
import PageTitle from '~/components/customerPortal/common/PageTitle'
import SectionError from '~/components/customerPortal/common/SectionError'
import { LoaderUsageSection } from '~/components/customerPortal/common/SectionLoading'
import useCustomerPortalTranslate from '~/components/customerPortal/common/useCustomerPortalTranslate'
import { Button } from '~/components/designSystem/Button'
import { Typography } from '~/components/designSystem/Typography'
import { WarningDialog, WarningDialogRef } from '~/components/designSystem/WarningDialog'
import { addToast } from '~/core/apolloClient'
import { intlFormatNumber } from '~/core/formats/intlFormatNumber'
import { deserializeAmount } from '~/core/serializers/serializeAmount'
import {
  CurrencyEnum,
  PlanInterval,
  useChangeCustomerPortalSubscriptionPlanMutation,
  useCreateCustomerPortalSubscriptionMutation,
  useCustomerPortalAvailablePlansQuery,
  useCustomerPortalSubscriptionsQuery,
  useTerminateCustomerPortalSubscriptionMutation,
} from '~/generated/graphql'

gql`
  query customerPortalAvailablePlans($productKey: String, $excludeCurrent: Boolean) {
    customerPortalAvailablePlans(productKey: $productKey, excludeCurrent: $excludeCurrent) {
      id
      code
      name
      description
      amountCents
      amountCurrency
      interval
      trialPeriod
    }
  }

  query customerPortalSubscriptions {
    customerPortalSubscriptions {
      collection {
        id
        name
        plan {
          id
          code
          name
          amountCents
          amountCurrency
          interval
        }
      }
    }
  }

  mutation changeCustomerPortalSubscriptionPlan(
    $input: ChangeCustomerPortalSubscriptionPlanInput!
  ) {
    changeCustomerPortalSubscriptionPlan(input: $input) {
      id
      plan {
        id
        code
        name
      }
    }
  }

  mutation createCustomerPortalSubscription($input: CreateCustomerPortalSubscriptionInput!) {
    createCustomerPortalSubscription(input: $input) {
      id
      plan {
        id
        code
        name
      }
    }
  }

  mutation terminateCustomerPortalSubscription($input: TerminateCustomerPortalSubscriptionInput!) {
    terminateCustomerPortalSubscription(input: $input) {
      id
      status
    }
  }
`

const extractProductKey = (planCode: string): string => planCode.split('-')[0] || 'other'

const formatPrice = (
  amountCents: number,
  currency: CurrencyEnum,
  interval: PlanInterval,
): string => {
  const amount = deserializeAmount(amountCents, currency)
  const formatted = intlFormatNumber(amount, {
    currencyDisplay: 'symbol',
    currency,
  })
  return `${formatted}/${interval}`
}

const PlansPage = () => {
  const { translate } = useCustomerPortalTranslate()
  const { goHome } = useCustomerPortalNavigation()

  const {
    data: subsData,
    loading: subsLoading,
    error: subsError,
    refetch: refetchSubs,
  } = useCustomerPortalSubscriptionsQuery({ fetchPolicy: 'network-only' })

  const {
    data: plansData,
    loading: plansLoading,
    error: plansError,
  } = useCustomerPortalAvailablePlansQuery({
    variables: { excludeCurrent: false },
    fetchPolicy: 'network-only',
  })

  const [changePlan, { loading: changing }] = useChangeCustomerPortalSubscriptionPlanMutation({
    onCompleted: (data) => {
      refetchSubs()
      const planName = data.changeCustomerPortalSubscriptionPlan?.plan?.name
      addToast({
        severity: 'success',
        message: planName
          ? translate('text_lago_portal_plan_switched_to', { plan: planName })
          : translate('text_lago_portal_plan_switched'),
      })
    },
    onError: (err) =>
      addToast({
        severity: 'danger',
        message: err.message || translate('text_lago_portal_plan_switch_failed'),
      }),
  })
  const [createSubscription, { loading: creating }] = useCreateCustomerPortalSubscriptionMutation({
    onCompleted: (data) => {
      refetchSubs()
      const planName = data.createCustomerPortalSubscription?.plan?.name
      addToast({
        severity: 'success',
        message: planName
          ? translate('text_lago_portal_product_added', { plan: planName })
          : translate('text_lago_portal_product_added_generic'),
      })
    },
    onError: (err) =>
      addToast({
        severity: 'danger',
        message: err.message || translate('text_lago_portal_add_product_failed'),
      }),
  })
  const [terminateSubscription, { loading: terminating }] =
    useTerminateCustomerPortalSubscriptionMutation({
      onCompleted: () => {
        refetchSubs()
        addToast({
          severity: 'success',
          message: translate('text_lago_portal_subscription_cancelled'),
        })
      },
      onError: (err) =>
        addToast({
          severity: 'danger',
          message: err.message || translate('text_lago_portal_cancel_failed'),
        }),
    })

  const cancelDialogRef = useRef<WarningDialogRef>(null)
  const [pendingCancelSubId, setPendingCancelSubId] = useState<string | null>(null)

  const activeSubs = subsData?.customerPortalSubscriptions?.collection ?? []
  const allPlans = plansData?.customerPortalAvailablePlans ?? []

  // Group plans by product key (aistack, growth, memory, etc.)
  const plansByProduct = useMemo(() => {
    const groups: Record<string, typeof allPlans> = {}
    for (const plan of allPlans) {
      const key = extractProductKey(plan.code)
      if (!groups[key]) groups[key] = []
      groups[key].push(plan)
    }
    return groups
  }, [allPlans])

  // Map subscribed plan codes to know which to mark as current
  const subscribedProducts = useMemo(() => {
    const set = new Map<string, { subId: string; planCode: string }>()
    for (const s of activeSubs) {
      if (s.plan?.code) {
        set.set(extractProductKey(s.plan.code), { subId: s.id, planCode: s.plan.code })
      }
    }
    return set
  }, [activeSubs])

  const handleChange = (subId: string, planCode: string) => {
    changePlan({ variables: { input: { subscriptionId: subId, planCode } } })
  }

  const handleAdd = (planCode: string) => {
    createSubscription({ variables: { input: { planCode } } })
  }

  const handleTerminate = (subId: string) => {
    setPendingCancelSubId(subId)
    cancelDialogRef.current?.openDialog()
  }

  if (subsError || plansError) {
    return <SectionError />
  }

  if (subsLoading || plansLoading) {
    return (
      <div className="flex flex-col gap-12">
        <LoaderUsageSection />
        <LoaderUsageSection />
      </div>
    )
  }

  const productKeys = Object.keys(plansByProduct).sort()

  return (
    <div className="flex flex-col gap-12">
      <PageTitle title={translate('text_lago_portal_plans_title')} goHome={goHome} />

      <Typography variant="bodyHl" color="grey700">
        {translate('text_lago_portal_plans_intro')}
      </Typography>

      {productKeys.map((productKey) => {
        const productPlans = plansByProduct[productKey]
        const currentForProduct = subscribedProducts.get(productKey)

        return (
          <div key={productKey} className="rounded-lg border border-grey-300 p-6">
            <div className="mb-4 flex items-center justify-between">
              <Typography variant="headline" color="grey700">
                {productKey.charAt(0).toUpperCase() + productKey.slice(1)}
              </Typography>
              {currentForProduct && (
                <Button
                  variant="quaternary"
                  danger
                  disabled={terminating}
                  onClick={() => handleTerminate(currentForProduct.subId)}
                >
                  {translate('text_lago_portal_cancel_plan')}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {productPlans.map((plan) => {
                const isCurrent = currentForProduct?.planCode === plan.code

                return (
                  <div
                    key={plan.id}
                    className={`flex flex-col gap-3 rounded-lg border p-4 ${
                      isCurrent ? 'bg-blue-50 border-blue-600' : 'border-grey-300'
                    }`}
                  >
                    <Typography variant="bodyHl" color="grey700">
                      {plan.name}
                    </Typography>
                    <Typography variant="body" color="grey600">
                      {formatPrice(plan.amountCents, plan.amountCurrency, plan.interval)}
                    </Typography>
                    {plan.description && (
                      <Typography variant="caption" color="grey500">
                        {plan.description}
                      </Typography>
                    )}

                    {isCurrent ? (
                      <Button variant="quaternary" disabled>
                        {translate('text_lago_portal_current_plan')}
                      </Button>
                    ) : currentForProduct ? (
                      <Button
                        variant="primary"
                        disabled={changing}
                        onClick={() => handleChange(currentForProduct.subId, plan.code)}
                      >
                        {translate('text_lago_portal_switch_to_plan')}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        disabled={creating}
                        onClick={() => handleAdd(plan.code)}
                      >
                        {translate('text_lago_portal_add_to_account')}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {productKeys.length === 0 && (
        <Typography variant="body" color="grey600">
          {translate('text_lago_portal_no_plans_available')}
        </Typography>
      )}

      <WarningDialog
        ref={cancelDialogRef}
        title={translate('text_lago_portal_cancel_plan')}
        description={translate('text_lago_portal_confirm_cancel_subscription')}
        continueText={translate('text_lago_portal_cancel_plan')}
        onContinue={() => {
          if (pendingCancelSubId) {
            return terminateSubscription({
              variables: { input: { subscriptionId: pendingCancelSubId } },
            })
          }
        }}
      />
    </div>
  )
}

export default PlansPage
