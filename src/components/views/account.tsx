"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Address, Hex } from "viem";
import { useEffect, useState } from "react";
import { useResource, useSession } from "../session";
import { PageTitle, Loading, Empty, Arrow, ErrorBox, Eyebrow, Tag, Avatar } from "../ui";
import { INTERESTS, INTENTS, NEIGHBORHOODS } from "@/lib/constants";
import { TripCard } from "./trip-card";
type Profile = {
  name: string;
  role: string;
  bio: string;
  interests: string[];
  intents: string[];
  neighborhood: string;
  city: string;
  visible: boolean;
  adult: boolean;
  onboarded: boolean;
};
const blank: Profile = {
  name: "",
  role: "",
  bio: "",
  interests: [],
  intents: [],
  neighborhood: "Anywhere in Tokyo",
  city: "tokyo",
  visible: false,
  adult: false,
  onboarded: true,
};
function toggle(items: string[], item: string, max: number) {
  return items.includes(item)
    ? items.filter((value) => value !== item)
    : items.length < max
      ? [...items, item]
      : items;
}
export function OnboardingView() {
  const { me, ready, api, refresh, login } = useSession(),
    router = useRouter(),
    [step, setStep] = useState(0),
    [form, setForm] = useState<Profile>(blank),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (me) setForm({ ...blank, ...me.user, adult: me.user.onboarded, onboarded: true });
  }, [me?.user.id]);
  const update = (value: Partial<Profile>) => setForm((previous) => ({ ...previous, ...value }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { name, role, bio, interests, intents, neighborhood, city, visible, adult, onboarded } =
        form;
      await api("me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          role,
          bio,
          interests,
          intents,
          neighborhood,
          city,
          visible,
          adult,
          onboarded,
        }),
      });
      await refresh();
      router.push("/tokyo");
    } catch (value) {
      setError(value instanceof Error ? value : new Error("Could not save."));
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <Loading />;
  if (!me)
    return (
      <Empty
        title="Make yourself at home."
        action={
          <button className="button lime" onClick={() => void login()}>
            Sign in <Arrow />
          </button>
        }
      >
        Start with email or a connected wallet.
      </Empty>
    );
  const titles = [
    "First, a little hello.",
    "What are you into?",
    "Find your corner.",
    "Your profile. Your choice.",
  ];
  return (
    <div className="onboarding-layout">
      <aside>
        <Eyebrow>WELCOME TO NEW FRIENDSHIP TECH</Eyebrow>
        <h1>
          A new city.
          <br />A familiar feeling.
        </h1>
        <p>Your preferences help us point you towards places and people that feel right.</p>
        <div className="onboarding-steps">
          {titles.map((title, index) => (
            <div key={title} className={step === index ? "active" : ""}>
              <span>{"0" + (index + 1)}</span>
              {title}
            </div>
          ))}
        </div>
      </aside>
      <form className="onboarding-form" onSubmit={save}>
        <div className="row-between">
          <Eyebrow>STEP {step + 1} OF 4</Eyebrow>
          <span className="muted small">Tokyo alpha</span>
        </div>
        <h2>{titles[step]}</h2>
        {step === 0 && (
          <>
            <label className="field">
              What should we call you?
              <input
                required
                minLength={2}
                maxLength={60}
                value={form.name}
                onChange={(event) => update({ name: event.target.value })}
                autoComplete="given-name"
              />
            </label>
            <label className="field">
              What do you do?
              <input
                maxLength={80}
                value={form.role}
                onChange={(event) => update({ role: event.target.value })}
                placeholder="Builder, designer, curious person…"
              />
            </label>
            <label className="field">
              A little about you
              <textarea
                rows={3}
                maxLength={300}
                value={form.bio}
                onChange={(event) => update({ bio: event.target.value })}
                placeholder="What are you making, exploring, or looking for?"
              />
            </label>
          </>
        )}
        {step === 1 && (
          <>
            <p className="muted">Choose up to five interests.</p>
            <div className="choice-grid">
              {INTERESTS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={"chip" + (form.interests.includes(item) ? " selected" : "")}
                  onClick={() => update({ interests: toggle(form.interests, item, 5) })}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="field-label">And what are you open to? Up to three.</p>
            <div className="choice-grid">
              {INTENTS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={"chip" + (form.intents.includes(item) ? " selected" : "")}
                  onClick={() => update({ intents: toggle(form.intents, item, 3) })}
                >
                  {item}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <p className="muted">
              Pick an area or keep your options open. We don't need your exact location.
            </p>
            <label className="field">
              Tokyo neighborhood
              <select
                value={form.neighborhood}
                onChange={(event) => update({ neighborhood: event.target.value })}
              >
                {NEIGHBORHOODS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <div className="note">
              Your preferences and membership travel with you when more cities launch.
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <label className="check-field">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(event) => update({ visible: event.target.checked })}
              />
              <span>
                <strong>Let members discover my profile.</strong>
                <small>
                  Your name, bio, interests, and broad neighborhood can appear. Contacts stay
                  private.
                </small>
              </span>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                required
                checked={form.adult}
                onChange={(event) => update({ adult: event.target.checked })}
              />
              <span>I confirm I am at least 18 years old.</span>
            </label>
            <p className="muted small">
              This does not subscribe you to the newsletter. You can change visibility at any time.
            </p>
          </>
        )}
        <ErrorBox error={error} />
        <div className="row-between onboarding-actions">
          {step > 0 ? (
            <button type="button" className="button ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button className="button lime" disabled={busy}>
            {busy ? "Saving…" : step === 3 ? "Make Tokyo yours" : "Continue"}
            <Arrow />
          </button>
        </div>
      </form>
    </div>
  );
}
export function SettingsView() {
  const { me, ready, api, refresh, login, notice, config, walletProvider } = useSession();
  const { data: blocks, reload: reloadBlocks } = useResource<{
    items: { targetId: string; name: string }[];
  }>(me ? "blocks" : null);
  const [contactType, setContactType] = useState("Telegram"),
    [contact, setContact] = useState(""),
    [share, setShare] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [publicConsent, setPublicConsent] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState<Error | null>(null),
    [ensTx, setEnsTx] = useState(""),
    [ensIntent, setEnsIntent] = useState("");
  async function action(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value : new Error("Could not update."));
    } finally {
      setBusy("");
    }
  }
  if (!ready) return <Loading />;
  if (!me)
    return (
      <Empty
        title="Your account starts here."
        action={
          <button className="button lime" onClick={() => void login()}>
            Sign in <Arrow />
          </button>
        }
      />
    );
  async function writeENS() {
    const prepared = await api<{
      intentId: string;
      from: Address;
      to: Address;
      data: Hex;
      chainId: number;
    }>("ens/description", {
      method: "POST",
      body: JSON.stringify({ name, description, consent: publicConsent }),
    });
    const provider = await walletProvider(prepared.from);
    const accounts = await provider.request({ method: "eth_accounts" });
    if (
      !Array.isArray(accounts) ||
      !accounts.some((address) => String(address).toLowerCase() === prepared.from.toLowerCase())
    )
      throw new Error("Select the wallet linked to this ENS name.");
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ("0x" + prepared.chainId.toString(16)) as Hex }],
    });
    const hash = await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: prepared.from,
          to: prepared.to,
          data: prepared.data,
          chainId: ("0x" + prepared.chainId.toString(16)) as Hex,
        },
      ],
    });
    setEnsIntent(prepared.intentId);
    setEnsTx(String(hash));
    notice("Record update submitted on Sepolia. Confirm it after the transaction is mined.");
  }
  return (
    <>
      <PageTitle
        eyebrow="MAKE IT YOURS"
        title="Profile & settings."
        description="Your preferences. Your identity. Your choice of what to share."
      />
      <ErrorBox error={error} />
      <div className="settings-grid">
        <TripCard />
        <section className="settings-panel">
          <div className="account-summary">
            <Avatar name={me.user.name} large />
            <div>
              <h2>{me.user.name}</h2>
              <p className="muted">{me.user.role}</p>
            </div>
          </div>
          <p>{me.user.bio}</p>
          <div className="tags">
            {me.user.interests.map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </div>
          <Link className="button ghost full" href="/onboarding">
            Edit profile and preferences <Arrow />
          </Link>
          <label className="check-field">
            <input
              type="checkbox"
              checked={me.user.visible}
              disabled={!!busy}
              onChange={(event) =>
                void action("visibility", () =>
                  api("me/visibility", {
                    method: "PATCH",
                    body: JSON.stringify({ visible: event.target.checked }),
                  }),
                )
              }
            />
            <span>
              <strong>Discoverable to members</strong>
              <small>Switching off also closes your active invitation.</small>
            </span>
          </label>
        </section>
        <section className="settings-panel">
          <Eyebrow>AFTER YOU BOTH ACCEPT</Eyebrow>
          <h2>Share a way to say hello.</h2>
          <p className="muted">Your contact is encrypted and hidden from the directory.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void action("contact", async () => {
                await api("me/contact", {
                  method: "PUT",
                  body: JSON.stringify({
                    type: contactType,
                    value: contact,
                    shareOnAcceptance: share,
                  }),
                });
                setContact("");
                notice("Contact preferences saved.");
              });
            }}
          >
            <label className="field">
              Contact type
              <select value={contactType} onChange={(event) => setContactType(event.target.value)}>
                <option>Telegram</option>
                <option>Email</option>
              </select>
            </label>
            <label className="field">
              {contactType === "Telegram" ? "Telegram username" : "Email address"}
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                required
                placeholder={contactType === "Telegram" ? "@yourname" : "you@example.com"}
              />
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={share}
                onChange={(event) => setShare(event.target.checked)}
              />
              <span>Share this contact with mutually accepted connections.</span>
            </label>
            <button className="button lime" disabled={!!busy}>
              {busy === "contact" ? "Saving…" : "Save contact"}
              <Arrow />
            </button>
          </form>
          <p className="muted small">
            {me.hasContact
              ? "A contact is stored. Enter a new value to change it."
              : "No contact has been added yet."}
          </p>
          {me.hasContact && (
            <button
              className="text-link"
              disabled={!!busy}
              onClick={() =>
                void action("remove-contact", async () => {
                  await api("me/contact", { method: "DELETE" });
                  notice("Contact removed from shared access.");
                })
              }
            >
              Remove stored contact
            </button>
          )}
        </section>
        <section className="settings-panel">
          <Eyebrow>PORTABLE IDENTITY / SEPOLIA</Eyebrow>
          <h2>Your ENSv2 passport.</h2>
          <p className="muted">
            Link a name that resolves to your verified wallet. You control any public record you
            choose to publish.
          </p>
          {!config?.ensEnabled && (
            <div className="note">
              ENSv2 requires configured Sepolia RPC access. Names and transactions are never
              simulated.
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void action("ens", async () => {
                await api("ens/link", { method: "POST", body: JSON.stringify({ name }) });
                notice("ENS name linked after fresh resolution.");
              });
            }}
          >
            <label className="field">
              ENS name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="you.your-community.eth"
                required
                maxLength={255}
              />
            </label>
            <button className="button ghost" disabled={!!busy || !config?.ensEnabled}>
              Link name <Arrow />
            </button>
          </form>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void action("ens-write", writeENS);
            }}
          >
            <label className="field">
              Public description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={160}
                rows={2}
              />
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={publicConsent}
                onChange={(event) => setPublicConsent(event.target.checked)}
                required
              />
              <span>I understand this text becomes a public blockchain record.</span>
            </label>
            <button className="button ghost" disabled={!!busy || !config?.ensWriteEnabled}>
              Update public record <Arrow />
            </button>
          </form>
          {ensTx && (
            <div className="note">
              <a
                href={"https://sepolia.etherscan.io/tx/" + ensTx}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Sepolia transaction
              </a>
              <button
                className="button small ghost"
                onClick={() =>
                  void action("confirm", async () => {
                    await api("ens/confirm", {
                      method: "POST",
                      body: JSON.stringify({ intentId: ensIntent, txHash: ensTx }),
                    });
                    notice("Record re-read from Sepolia.");
                  })
                }
              >
                Verify mined update
              </button>
            </div>
          )}
        </section>
        <section className="settings-panel">
          <Eyebrow>LINKED WALLETS</Eyebrow>
          <h2>Your account stays yours.</h2>
          <p className="muted">
            Names and wallets are linked identifiers. They do not replace your account or transfer
            your membership.
          </p>
          <div className="wallet-list">
            {me.walletAddresses.length ? (
              me.walletAddresses.map((address) => <p key={address}>{address}</p>)
            ) : (
              <p>No verified wallets synced yet.</p>
            )}
          </div>
          <button
            className="button ghost"
            disabled={!!busy}
            onClick={() =>
              void action("wallets", async () => {
                await api("me/wallets", { method: "POST" });
                notice("Verified wallets refreshed.");
              })
            }
          >
            Refresh wallet links <Arrow />
          </button>
          <Link href="/membership" className="text-link">
            Manage membership <Arrow />
          </Link>
        </section>
        <section className="settings-panel">
          <Eyebrow>YOUR BOUNDARIES</Eyebrow>
          <h2>Blocked members</h2>
          <p className="muted">
            Unblocking restores access to any existing accepted connection when contact sharing is
            still enabled.
          </p>
          {blocks?.items.length ? (
            blocks.items.map((item) => (
              <div className="admin-row" key={item.targetId}>
                <span>{item.name}</span>
                <button
                  className="button small ghost"
                  disabled={!!busy}
                  onClick={() =>
                    void action("unblock", async () => {
                      await api("blocks/" + item.targetId, { method: "DELETE" });
                      await reloadBlocks();
                      notice("Member unblocked.");
                    })
                  }
                >
                  Unblock
                </button>
              </div>
            ))
          ) : (
            <p className="note">No blocked members.</p>
          )}
        </section>
      </div>
    </>
  );
}
