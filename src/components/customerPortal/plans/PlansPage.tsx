import { gql } from '@apollo/client'
import { Icon } from 'lago-design-system'
import { useMemo, useRef, useState } from 'react'

import useCustomerPortalNavigation from '~/components/customerPortal/common/hooks/useCustomerPortalNavigation'
import PageTitle from '~/components/customerPortal/common/PageTitle'
import SectionError from '~/components/customerPortal/common/SectionError'
import { LoaderUsageSection } from '~/components/customerPortal/common/SectionLoading'
import useCustomerPortalTranslate from '~/components/customerPortal/common/useCustomerPortalTranslate'
import { Button } from '~/components/designSystem/Button'
import { Chip } from '~/components/designSystem/Chip'
import { Typography } from '~/components/designSystem/Typography'
import { WarningDialog, WarningDialogRef } from '~/components/designSystem/WarningDialog'
import { addToast } from '~/core/apolloClient'
import { getIntervalTranslationKey } from '~/core/constants/form'
import { intlFormatNumber } from '~/core/formats/intlFormatNumber'
import { deserializeAmount } from '~/core/serializers/serializeAmount'
import {
  CurrencyEnum,
  PlanInterval,
  StatusTypeEnum,
  useChangeCustomerPortalSubscriptionPlanMutation,
  useCreateCustomerPortalSubscriptionMutation,
  useCustomerPortalAvailablePlansQuery,
  useCustomerPortalSubscriptionsQuery,
  useTerminateCustomerPortalSubscriptionMutation,
} from '~/generated/graphql'
import { tw } from '~/styles/utils'

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
      metadata {
        key
        value
      }
    }
  }

  query customerPortalSubscriptions {
    customerPortalSubscriptions {
      collection {
        id
        name
        status
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
      externalId
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

const getMetadataValue = (
  metadata: ReadonlyArray<{ key: string; value?: string | null }> | null | undefined,
  key: string,
): string | undefined => metadata?.find((m) => m.key === key)?.value ?? undefined

const isBundle = (
  metadata: ReadonlyArray<{ key: string; value?: string | null }> | null | undefined,
): boolean => getMetadataValue(metadata, 'bundle') === 'true'

const formatPrice = (amountCents: number, currency: CurrencyEnum): string => {
  const amount = deserializeAmount(amountCents, currency)

  return intlFormatNumber(amount, {
    currencyDisplay: 'symbol',
    currency,
    // Whole amounts read cleaner without trailing cents ($19 rather than $19.00)
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  })
}

const INTERVAL_ORDER: PlanInterval[] = [
  PlanInterval.Weekly,
  PlanInterval.Monthly,
  PlanInterval.Quarterly,
  PlanInterval.Semiannual,
  PlanInterval.Yearly,
]

// Interval is already conveyed by the toggle, so a name like "Memory Starter (Annual)"
// only repeats it.
const formatPlanName = (name: string): string =>
  name.replace(/\s*\((annual|annually|yearly|monthly|weekly|quarterly)\)\s*$/i, '').trim() || name

const formatProductName = (productKey: string): string =>
  productKey.charAt(0).toUpperCase() + productKey.slice(1)

// Plan descriptions are written as a lead-in followed by a comma-separated list of
// what the tier includes ("Scaling teams — more projects, prediction overage, SSO").
// Split that tail into checkmark bullets when it looks like a list; otherwise the
// description renders as a plain paragraph.
const parseDescription = (
  description: string,
): { lead: string; features: string[] } => {
  const [head, ...rest] = description.split(/\s+[—–-]\s+/)

  if (!rest.length) {
    return { lead: description, features: [] }
  }

  const features = rest
    .join(' - ')
    .replace(/\.$/, '')
    .split(',')
    .map((feature) => feature.trim())
    .filter(Boolean)

  if (features.length < 2) {
    return { lead: description, features: [] }
  }

  return { lead: head.trim(), features }
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
  // Per-product override of the billing interval shown in the grid; unset products
  // fall back to the interval of their active plan (or the shortest one available).
  const [selectedIntervals, setSelectedIntervals] = useState<Record<string, PlanInterval>>({})

  const allReturnedSubs = subsData?.customerPortalSubscriptions?.collection ?? []
  // Lago returns ALL subscriptions including terminated; each plan switch creates
  // a new record. Filter to only currently-active ones for "Current plan" badges.
  const activeSubs = allReturnedSubs.filter((s) => s.status === StatusTypeEnum.Active)
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
    const set = new Map<
      string,
      { subId: string; planCode: string; planName?: string | null; interval?: PlanInterval }
    >()

    for (const s of activeSubs) {
      if (s.plan?.code) {
        set.set(extractProductKey(s.plan.code), {
          subId: s.id,
          planCode: s.plan.code,
          planName: s.plan.name,
          interval: s.plan.interval,
        })
      }
    }
    return set
  }, [activeSubs])

  const handleChange = (planCode: string) => {
    changePlan({ variables: { input: { planCode } } })
  }

  const handleAdd = (planCode: string) => {
    createSubscription({ variables: { input: { planCode } } })
  }

  const handleTerminate = (productKey: string) => {
    setPendingCancelSubId(productKey)
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
    <div className="flex flex-col gap-8">
      <div>
        <PageTitle title={translate('text_lago_portal_plans_title')} goHome={goHome} />

        <Typography variant="body" color="grey600">
          {translate('text_lago_portal_plans_intro')}
        </Typography>
      </div>

      {productKeys.map((productKey) => {
        const productPlans = plansByProduct[productKey]
        const currentForProduct = subscribedProducts.get(productKey)

        const availableIntervals = INTERVAL_ORDER.filter((interval) =>
          productPlans.some((plan) => plan.interval === interval),
        )
        const activeInterval =
          selectedIntervals[productKey] ??
          (currentForProduct?.interval && availableIntervals.includes(currentForProduct.interval)
            ? currentForProduct.interval
            : availableIntervals[0])

        const visiblePlans = productPlans
          .filter((plan) => plan.interval === activeInterval)
          .sort((a, b) => a.amountCents - b.amountCents)

        return (
          <section key={productKey}>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4 pb-4 shadow-b">
              <div className="flex flex-col gap-1">
                <Typography variant="subhead1" color="grey700">
                  {formatProductName(productKey)}
                </Typography>

                {currentForProduct?.planName && (
                  <Typography variant="caption" color="grey600">
                    {translate('text_lago_portal_current_plan')}:{' '}
                    {formatPlanName(currentForProduct.planName)}
                  </Typography>
                )}
              </div>

              <div className="flex items-center gap-3">
                {availableIntervals.length > 1 && (
                  <div className="flex items-center rounded-lg bg-grey-100 p-1">
                    {availableIntervals.map((interval) => {
                      const isActive = interval === activeInterval

                      return (
                        <button
                          key={interval}
                          type="button"
                          aria-pressed={isActive}
                          className={tw(
                            'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-white text-grey-700 shadow-sm'
                              : 'text-grey-600 hover:text-grey-700',
                          )}
                          onClick={() =>
                            setSelectedIntervals((prev) => ({ ...prev, [productKey]: interval }))
                          }
                        >
                          {translate(getIntervalTranslationKey[interval])}
                        </button>
                      )
                    })}
                  </div>
                )}

                {currentForProduct && (
                  <Button
                    variant="quaternary"
                    danger
                    disabled={terminating}
                    onClick={() => handleTerminate(productKey)}
                  >
                    {translate('text_lago_portal_cancel_plan')}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visiblePlans.map((plan) => {
                const isCurrent = currentForProduct?.planCode === plan.code
                const { lead, features } = parseDescription(plan.description ?? '')

                return (
                  <div
                    key={plan.id}
                    className={tw(
                      'flex h-full flex-col rounded-xl border bg-white p-6 shadow-sm transition-all duration-250',
                      isCurrent
                        ? 'border-blue-600 ring-1 ring-blue-600'
                        : 'border-grey-300 hover:-translate-y-1 hover:border-grey-400 hover:shadow-lg',
                    )}
                  >
                    <div className="flex min-h-6 items-start justify-between gap-2">
                      <Typography variant="bodyHl" color="grey700">
                        {formatPlanName(plan.name)}
                      </Typography>

                      {isCurrent ? (
                        <Chip
                          size="small"
                          icon="validate-filled"
                          iconColor="success"
                          label={translate('text_lago_portal_current_plan')}
                        />
                      ) : (
                        isBundle(plan.metadata) && (
                          <Chip size="small" label={translate('text_lago_portal_bundle_badge')} />
                        )
                      )}
                    </div>

                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className="font-sans text-4xl font-semibold text-grey-700">
                        {formatPrice(plan.amountCents, plan.amountCurrency)}
                      </span>

                      <Typography variant="body" color="grey500">
                        {`/ ${translate(getIntervalTranslationKey[plan.interval]).toLowerCase()}`}
                      </Typography>
                    </div>

                    {!!plan.description && (
                      <>
                        <div className="my-5 h-px bg-grey-200" />

                        <Typography variant="caption" color="grey600">
                          {lead}
                        </Typography>

                        {!!features.length && (
                          <ul className="mt-3 flex flex-col gap-2">
                            {features.map((feature) => (
                              <li key={feature} className="flex items-start gap-2">
                                <Icon
                                  className="mt-0.5 shrink-0"
                                  name="validate-filled"
                                  size="small"
                                  color="success"
                                />

                                <Typography variant="caption" color="grey700">
                                  {feature}
                                </Typography>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}

                    <div className="mt-auto pt-8">
                      {isCurrent ? (
                        <Button variant="secondary" disabled fullWidth>
                          {translate('text_lago_portal_current_plan')}
                        </Button>
                      ) : currentForProduct ? (
                        <Button
                          variant="secondary"
                          disabled={changing}
                          fullWidth
                          onClick={() => handleChange(plan.code)}
                        >
                          {translate('text_lago_portal_switch_to_plan')}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          disabled={creating}
                          fullWidth
                          onClick={() => handleAdd(plan.code)}
                        >
                          {translate('text_lago_portal_add_to_account')}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
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
              variables: { input: { productKey: pendingCancelSubId } },
            })
          }
        }}
      />
    </div>
  )
}

export default PlansPage
