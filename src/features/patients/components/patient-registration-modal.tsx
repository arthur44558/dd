'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  patientRegistrationSchema,
  type PatientRegistrationInput,
} from '../schemas';
import { registerPatient } from '../actions';

export interface PatientRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (patient: { id: string; mrn: string; fullName: string }) => void;
}

export function PatientRegistrationModal({
  open,
  onOpenChange,
  onSuccess,
}: PatientRegistrationModalProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PatientRegistrationInput>({
    resolver: zodResolver(patientRegistrationSchema),
    defaultValues: {
      fullName: '',
      dob: '',
      gender: 'male',
      primaryPhone: '',
      address: '',
      isSharedContact: false,
      alternateContacts: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'alternateContacts',
  });

  const onSubmit = async (data: PatientRegistrationInput) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const res = await registerPatient(data);
      if (res.success && res.data) {
        reset();
        onOpenChange(false);
        if (onSuccess) {
          onSuccess(res.data);
        }
      } else {
        setServerError(res.error || 'Failed to register patient');
      }
    } catch {
      setServerError('An unexpected error occurred during patient registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setServerError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onClose={handleClose}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sky-600" />
            Patient Registration
          </DialogTitle>
          <DialogDescription>
            Register a new patient into the continuity registry. MRN will be assigned automatically.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Registration Error</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="e.g. Ramesh Kumar"
                {...register('fullName')}
                aria-invalid={!!errors.fullName}
              />
              {errors.fullName && (
                <p className="text-xs text-red-600">{errors.fullName.message}</p>
              )}
            </div>

            {/* Date of Birth */}
            <div className="space-y-1">
              <Label htmlFor="dob">Date of Birth (YYYY-MM-DD) *</Label>
              <Input
                id="dob"
                type="date"
                {...register('dob')}
                aria-invalid={!!errors.dob}
              />
              {errors.dob && (
                <p className="text-xs text-red-600">{errors.dob.message}</p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-1">
              <Label htmlFor="gender">Gender *</Label>
              <Select id="gender" {...register('gender')}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="unknown">Unknown</option>
              </Select>
              {errors.gender && (
                <p className="text-xs text-red-600">{errors.gender.message}</p>
              )}
            </div>

            {/* Primary Phone */}
            <div className="space-y-1">
              <Label htmlFor="primaryPhone">Primary Phone Number *</Label>
              <Input
                id="primaryPhone"
                placeholder="e.g. 9876543210"
                {...register('primaryPhone')}
                aria-invalid={!!errors.primaryPhone}
              />
              {errors.primaryPhone && (
                <p className="text-xs text-red-600">{errors.primaryPhone.message}</p>
              )}
            </div>
          </div>

          {/* Shared Contact Checkbox */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                {...register('isSharedContact')}
              />
              <div className="text-xs">
                <span className="font-semibold text-amber-900 block">
                  Shared Family / Proxy Phone Number
                </span>
                <span className="text-amber-800">
                  Check this if this phone number is shared with family members or caregivers. When flagged, the system restricts disclosure of sensitive clinical details over reminder channels.
                </span>
              </div>
            </label>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <Label htmlFor="address">Address (Optional)</Label>
            <Textarea
              id="address"
              placeholder="Residential address..."
              rows={2}
              {...register('address')}
            />
            {errors.address && (
              <p className="text-xs text-red-600">{errors.address.message}</p>
            )}
          </div>

          {/* Alternate Contacts Section */}
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Alternate Contacts</h4>
                <p className="text-xs text-slate-500">
                  Emergency contacts, relatives, or secondary phones.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    contactType: 'relative',
                    contactValue: '',
                    isSharedContact: false,
                    notes: '',
                  })
                }
                className="gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Contact
              </Button>
            </div>

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">
                    Contact #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Contact Type</Label>
                    <Select {...register(`alternateContacts.${index}.contactType` as const)}>
                      <option value="secondary_phone">Secondary Phone</option>
                      <option value="emergency_contact">Emergency Contact</option>
                      <option value="relative">Relative</option>
                      <option value="email">Email</option>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Contact Value</Label>
                    <Input
                      placeholder="Phone or Email"
                      {...register(`alternateContacts.${index}.contactValue` as const)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <Input
                    placeholder="Notes (e.g. Brother, Evening only)"
                    {...register(`alternateContacts.${index}.notes` as const)}
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      {...register(`alternateContacts.${index}.isSharedContact` as const)}
                    />
                    Shared contact number
                  </label>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Complete Registration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
