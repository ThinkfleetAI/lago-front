import { gql, useApolloClient, useMutation } from '@apollo/client'
import { useFormik } from 'formik'
import { forwardRef } from 'react'
import { object, string } from 'yup'

import { Button } from '~/components/designSystem/Button'
import { Dialog, DialogRef } from '~/components/designSystem/Dialog'
import { TextInputField } from '~/components/form'
import { addToast, hasDefinedGQLError, switchCurrentOrganization } from '~/core/apolloClient'
import { HOME_ROUTE, useNavigate } from '~/core/router'
import { LagoApiError } from '~/generated/graphql'
import { useInternationalization } from '~/hooks/core/useInternationalization'

// Inline document via Apollo `useMutation` rather than a codegen-generated hook:
// the build consumes the committed `generated/graphql.tsx` and does not run
// codegen, so a generated `useCreateOrganizationMutation` wouldn't exist yet.
// Matches the `createOrganization` mutation in ThinkfleetAI/lago-api.
const CREATE_ORGANIZATION = gql`
  mutation createOrganization($name: String!) {
    createOrganization(name: $name) {
      id
      name
    }
  }
`

export type CreateOrganizationDialogRef = DialogRef

export const CreateOrganizationDialog = forwardRef<DialogRef>((_props, ref) => {
  const { translate } = useInternationalization()
  const apolloClient = useApolloClient()
  const navigate = useNavigate()

  const [createOrganization] = useMutation(CREATE_ORGANIZATION, {
    context: { silentErrorCodes: [LagoApiError.UnprocessableEntity] },
    onCompleted: async (data) => {
      const organization = data?.createOrganization

      if (!organization?.id) return

      addToast({
        severity: 'success',
        // Plain message (no translation key yet); add a key when localizing.
        message: translate('text_create_organization_success') || 'Organization created',
      })

      // Re-scope the whole app to the brand-new org, then land on its home.
      await switchCurrentOrganization(apolloClient, organization.id)
      navigate(HOME_ROUTE)
    },
  })

  const formikProps = useFormik<{ name: string }>({
    initialValues: { name: '' },
    validationSchema: object().shape({
      name: string().required(''),
    }),
    validateOnMount: true,
    enableReinitialize: true,
    onSubmit: async ({ name }, { resetForm }) => {
      const result = await createOrganization({ variables: { name: name.trim() } })

      if (result.errors) {
        if (hasDefinedGQLError('ValueAlreadyExist', result.errors, 'name')) {
          formikProps.setFieldError('name', 'Organization name is already used')
        }
        return
      }

      resetForm()
    },
  })

  return (
    <Dialog
      ref={ref}
      title="Create a new organization"
      description="Spin up an independent organization with its own plans, customers, billing entity, and API key."
      onClose={() => formikProps.resetForm()}
      actions={({ closeDialog }) => (
        <>
          <Button variant="quaternary" onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!formikProps.isValid || !formikProps.dirty}
            onClick={async () => {
              await formikProps.submitForm()
              closeDialog()
            }}
          >
            Create organization
          </Button>
        </>
      )}
    >
      <div className="mb-8">
        <TextInputField
          name="name"
          label="Organization name"
          placeholder="e.g. Flobyte"
          formikProps={formikProps}
        />
      </div>
    </Dialog>
  )
})

CreateOrganizationDialog.displayName = 'CreateOrganizationDialog'
