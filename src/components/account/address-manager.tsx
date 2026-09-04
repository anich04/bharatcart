"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import {
  saveAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  type AddressActionState,
} from "@/lib/actions/address";
import { INDIAN_STATES } from "@/lib/validation/address";

export type Address = {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

const input =
  "border-input bg-background focus:ring-ring h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-2";

function AddressForm({ editing, onDone }: { editing: Address | null; onDone: () => void }) {
  const [state, action, pending] = useActionState<AddressActionState, FormData>(
    saveAddressAction,
    {},
  );
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={action} className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
      {editing && <input type="hidden" name="id" value={editing.id} />}
      {state.error && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm sm:col-span-2">
          {state.error}
        </p>
      )}
      <input
        name="fullName"
        placeholder="Full name"
        defaultValue={editing?.fullName}
        required
        className={input}
      />
      <input
        name="phone"
        placeholder="10-digit mobile"
        defaultValue={editing?.phone}
        required
        className={input}
      />
      <input
        name="line1"
        placeholder="Flat, house no., building"
        defaultValue={editing?.line1}
        required
        className={input + " sm:col-span-2"}
      />
      <input
        name="line2"
        placeholder="Area, street (optional)"
        defaultValue={editing?.line2 ?? ""}
        className={input + " sm:col-span-2"}
      />
      <input
        name="landmark"
        placeholder="Landmark (optional)"
        defaultValue={editing?.landmark ?? ""}
        className={input}
      />
      <input
        name="city"
        placeholder="City"
        defaultValue={editing?.city}
        required
        className={input}
      />
      <select name="state" defaultValue={editing?.state ?? ""} required className={input}>
        <option value="" disabled>
          Select state
        </option>
        {INDIAN_STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        name="pincode"
        placeholder="6-digit PIN code"
        defaultValue={editing?.pincode}
        required
        className={input}
      />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={editing?.isDefault}
          className="accent-primary size-4"
        />
        Set as default address
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground h-10 rounded-md px-4 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save address"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="border-input hover:bg-muted h-10 rounded-md border px-4 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(addresses.length === 0);
  const [editing, setEditing] = useState<Address | null>(null);
  const [, startTransition] = useTransition();

  const remove = (id: string) =>
    startTransition(async () => {
      await deleteAddressAction(id);
      router.refresh();
    });
  const makeDefault = (id: string) =>
    startTransition(async () => {
      await setDefaultAddressAction(id);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      {addresses.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="border-border relative rounded-lg border p-4 text-sm">
              {a.isDefault && (
                <span className="bg-primary/10 text-primary absolute top-3 right-3 rounded px-2 py-0.5 text-xs font-medium">
                  Default
                </span>
              )}
              <p className="font-medium">{a.fullName}</p>
              <p className="text-muted-foreground">{a.phone}</p>
              <p className="text-muted-foreground mt-1">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}
                {a.landmark ? `, ${a.landmark}` : ""}
              </p>
              <p className="text-muted-foreground">
                {a.city}, {a.state} — {a.pincode}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <button
                  onClick={() => {
                    setEditing(a);
                    setShowForm(true);
                  }}
                  className="text-primary hover:underline"
                >
                  Edit
                </button>
                {!a.isDefault && (
                  <button
                    onClick={() => makeDefault(a.id)}
                    className="text-primary hover:underline"
                  >
                    Set default
                  </button>
                )}
                <button onClick={() => remove(a.id)} className="text-destructive hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <AddressForm
          editing={editing}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      ) : (
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="border-input hover:bg-muted w-fit rounded-md border px-4 py-2 text-sm font-medium"
        >
          + Add a new address
        </button>
      )}
    </div>
  );
}
