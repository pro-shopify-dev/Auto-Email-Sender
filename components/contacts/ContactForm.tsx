"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import type { PublicContact } from "@/models/contact";

// Everything except the read-only/derived fields (stage is computed, never edited).
type FormState = Omit<
  PublicContact,
  | "id"
  | "lastEmailedAt"
  | "draftReservedAt"
  | "repliedAt"
  | "stage"
  | "createdAt"
  | "updatedAt"
>;

const empty: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  jobTitle: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
  notes: "",
  tags: [],
  emailStatus: "active",
};

export function ContactForm({
  open,
  onOpenChange,
  contact,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: PublicContact | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(contact ?? empty);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(contact);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit && contact) {
        await apiFetch(`/api/contacts/${contact.id}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
      } else {
        await apiFetch("/api/contacts", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      toast.success(isEdit ? "Contact updated" : "Contact created");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error("Could not save", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const field = (
    key: keyof FormState,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value as FormState[typeof key])}
        {...props}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit contact" : "New contact"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          {field("firstName", "First name")}
          {field("lastName", "Last name")}
        </div>
        {field("email", "Email", { type: "email", required: true })}
        <div className="grid grid-cols-2 gap-3">
          {field("phone", "Phone")}
          {field("company", "Company")}
        </div>
        {field("jobTitle", "Job title")}
        {field("address", "Street")}
        <div className="grid grid-cols-2 gap-3">
          {field("city", "City")}
          {field("state", "State")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("zipCode", "ZIP")}
          {field("country", "Country")}
        </div>
        <div className="space-y-1.5">
          <Label>Tags</Label>
          <TagInput
            value={form.tags}
            onChange={(tags) => set("tags", tags)}
            placeholder="Add tag and press Enter"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create contact"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
