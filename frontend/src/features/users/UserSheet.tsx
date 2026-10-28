import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Sheet } from '../../components/ui/Overlay'
import { ApiError, errorMessage } from '../../lib/api'
import { useBranches, useCreateStaff, useUpdateStaff, type ManagedRole, type StaffInput, type StaffMember, type StaffWithPassword } from './api'

const roles: ManagedRole[] = ['Employee', 'Manager', 'Admin']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Errors = Partial<Record<keyof StaffInput, string>>

function emptyInput(member?: StaffMember | null): StaffInput {
  return {
    firstName: member?.firstName ?? '',
    lastName: member?.lastName ?? '',
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    employeeNumber: member?.employeeNumber ?? '',
    role: member?.role ?? 'Employee',
    branchId: member?.branchId ?? null,
    position: member?.position ?? '',
    hireDate: member?.hireDate ?? '',
  }
}

/** Personel ekleme / düzenleme paneli. */
export function UserSheet({
  open,
  member,
  onClose,
  onCreated,
}: {
  open: boolean
  member: StaffMember | null
  onClose: () => void
  onCreated: (result: StaffWithPassword) => void
}) {
  const { t } = useTranslation()
  return (
    <Sheet
      open={open}
      onClose={onClose}
      closeLabel={t('common.close')}
      title={member ? t('users.form.editTitle') : t('users.form.createTitle')}
      description={member?.fullName}
    >
      {/* key: her açılışta form temiz başlasın */}
      <UserForm key={member?.id ?? 'new'} member={member} onClose={onClose} onCreated={onCreated} />
    </Sheet>
  )
}

function UserForm({
  member,
  onClose,
  onCreated,
}: {
  member: StaffMember | null
  onClose: () => void
  onCreated: (result: StaffWithPassword) => void
}) {
  const { t } = useTranslation()
  const [values, setValues] = useState<StaffInput>(() => emptyInput(member))
  const [errors, setErrors] = useState<Errors>({})
  const branches = useBranches()
  const create = useCreateStaff()
  const update = useUpdateStaff()
  const saving = create.isPending || update.isPending

  const set = <K extends keyof StaffInput>(key: K, value: StaffInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): Errors {
    const e: Errors = {}
    if (!values.firstName.trim()) e.firstName = t('errors.required')
    if (!values.lastName.trim()) e.lastName = t('errors.required')
    if (!values.email.trim()) e.email = t('errors.required')
    else if (!EMAIL_RE.test(values.email.trim())) e.email = t('errors.email')
    return e
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return

    const input: StaffInput = {
      ...values,
      phone: values.phone?.trim() || null,
      employeeNumber: values.employeeNumber?.trim() || null,
      position: values.position?.trim() || null,
      hireDate: values.hireDate || null,
    }

    try {
      if (member) {
        await update.mutateAsync({ id: member.id, input })
        toast.success(t('users.form.updated'))
        onClose()
      } else {
        const result = await create.mutateAsync(input)
        toast.success(t('users.form.created', { name: result.user.fullName }))
        onCreated(result)
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_taken') setErrors({ email: errorMessage(err, t) })
      else toast.error(errorMessage(err, t))
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('users.form.firstName')} error={errors.firstName}>
            {(p) => <Input {...p} autoComplete="off" value={values.firstName} onChange={(e) => set('firstName', e.target.value)} />}
          </Field>
          <Field label={t('users.form.lastName')} error={errors.lastName}>
            {(p) => <Input {...p} autoComplete="off" value={values.lastName} onChange={(e) => set('lastName', e.target.value)} />}
          </Field>
        </div>

        <Field label={t('users.form.email')} hint={t('users.form.emailHint')} error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="off" value={values.email} onChange={(e) => set('email', e.target.value)} />}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('users.form.phone')} optional={t('common.optional')}>
            {(p) => <Input {...p} type="tel" value={values.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />}
          </Field>
          <Field label={t('users.form.employeeNumber')} optional={t('common.optional')}>
            {(p) => <Input {...p} value={values.employeeNumber ?? ''} onChange={(e) => set('employeeNumber', e.target.value)} />}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('profile.fields.position')} optional={t('common.optional')}>
            {(p) => <Input {...p} maxLength={100} value={values.position ?? ''} onChange={(e) => set('position', e.target.value)} />}
          </Field>
          <Field label={t('profile.fields.hireDate')} optional={t('common.optional')}>
            {(p) => <Input {...p} type="date" value={values.hireDate ?? ''} onChange={(e) => set('hireDate', e.target.value)} />}
          </Field>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">{t('users.form.role')}</legend>
          <div className="mt-2 space-y-2">
            {roles.map((role) => {
              const active = values.role === role
              return (
                <label
                  key={role}
                  className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${active ? 'border-ink bg-accent-soft' : 'border-line hover:bg-panel-2'}`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={active}
                    onChange={() => set('role', role)}
                    className="sr-only"
                  />
                  <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-sm border-2 transition-colors ${active ? 'border-ink' : 'border-line'}`}>
                    {active && <motion.span layoutId="role-dot" className="size-2 rounded-sm bg-ink" />}
                  </span>
                  <span>
                    <span className="block font-medium">{t(`roles.${role}`)}</span>
                    <span className="block text-sm text-ink-soft">{t(`users.form.roleHints.${role}`)}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {(branches.data?.length ?? 0) > 1 && (
          <Field label={t('users.form.branch')}>
            {(p) => (
              <Select {...p} value={values.branchId ?? ''} onChange={(e) => set('branchId', e.target.value || null)}>
                {branches.data!.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>

      <div className="sticky bottom-0 -mx-6 mt-8 flex justify-end gap-2 border-t border-line bg-panel px-6 pt-4 -mb-5 pb-5">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={saving}>
          {member ? t('common.save') : t('users.form.create')}
        </Button>
      </div>
    </form>
  )
}
