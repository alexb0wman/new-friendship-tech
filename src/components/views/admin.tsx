"use client";
import { useState } from "react";
import { useResource, useSession } from "../session";
import { PageTitle, Loading, AccessState, Tag, Arrow, Modal, ErrorBox } from "../ui";
import type { ContentItem, Invoice } from "@/lib/types";
interface AdminData {
  places: {
    id: string;
    name: string;
    slug: string;
    city: string;
    category: string;
    published: boolean;
    fixture: boolean;
  }[];
  events: { id: string; title: string; fixture: boolean }[];
  content: ContentItem[];
  reports: { id: string; reason: string; status: string; targetId: string }[];
  users: { id: string; name: string; suspended: boolean; fixture: boolean }[];
  invoices: Invoice[];
}
const initialContent = {
  slug: "",
  kind: "story",
  section: "travel",
  title: "",
  summary: "",
  body: "",
  sourceUrl: "https://",
  city: null,
  tags: [],
  status: "draft",
  featuredRank: null,
};
const initialPlace = {
  name: "",
  slug: "",
  city: "tokyo",
  neighborhood: "Shibuya",
  category: "Coffee",
  note: "",
  tags: ["Coffee"],
  mapUrl: "https://www.google.com/maps/search/?api=1&query=",
  sourceUrl: "https://",
  price: null,
  preview: false,
  published: false,
  reviewedAt: null,
  artwork: "01",
};
export function AdminView() {
  const { data, error, loading, reload } = useResource<AdminData>("admin"),
    { api, notice } = useSession(),
    [open, setOpen] = useState(false),
    [json, setJson] = useState(JSON.stringify(initialPlace, null, 2)),
    [formError, setFormError] = useState<Error | null>(null),
    [tab, setTab] = useState("Places"),
    [mode, setMode] = useState<"place" | "content">("place"),
    [contentJson, setContentJson] = useState(JSON.stringify(initialContent, null, 2));
  async function act(path: string, body: unknown) {
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      await reload();
      notice("Updated and audited.");
    } catch (error) {
      notice(error instanceof Error ? error.message : "Could not update.");
    }
  }
  async function add(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      if (mode === "content")
        await api("admin/content", { method: "POST", body: contentJson });
      else await api("admin/places", { method: "POST", body: json });
      setOpen(false);
      await reload();
    } catch (error) {
      setFormError(error instanceof Error ? error : new Error("Could not save."));
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="CONTENT & OPERATIONS"
        title="Behind the scenes."
        description="Only administrators can access this area. Changes are audited."
        action={
          <button
            className="button lime"
            onClick={() => {
              if (tab === "Content") {
                setContentJson(JSON.stringify(initialContent, null, 2));
                setMode("content");
              } else {
                setJson(JSON.stringify(initialPlace, null, 2));
                setMode("place");
              }
              setFormError(null);
              setOpen(true);
            }}
          >
            {tab === "Content" ? "Add an entry" : "Add a place"} <Arrow />
          </button>
        }
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <AccessState error={error} retry={reload} />
      ) : (
        data && (
          <>
            <div className="admin-stats">
              <div>
                <strong>{data.places.length}</strong>
                <span>Places</span>
              </div>
              <div>
                <strong>{data.content.length}</strong>
                <span>Entries</span>
              </div>
              <div>
                <strong>{data.users.length}</strong>
                <span>Accounts</span>
              </div>
              <div>
                <strong>{data.reports.filter((row) => row.status === "open").length}</strong>
                <span>Open reports</span>
              </div>
            </div>
            <div className="filter-chips">
              {["Places", "Content", "Members", "Reports", "Invoices"].map((item) => (
                <button
                  key={item}
                  className={"chip" + (tab === item ? " selected" : "")}
                  onClick={() => setTab(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="admin-list">
              {tab === "Places" &&
                data.places.map((place) => (
                  <div className="admin-row" key={place.id}>
                    <div>
                      <strong>{place.name}</strong>
                      <p className="muted small">
                        {place.city} / {place.category} {place.fixture ? "/ sample" : ""}
                      </p>
                    </div>
                    <div className="button-row">
                      <Tag lime={place.published}>{place.published ? "Published" : "Draft"}</Tag>
                      <button
                        className="button small ghost"
                        onClick={() => {
                          const keys = [
                            "id",
                            "name",
                            "slug",
                            "city",
                            "neighborhood",
                            "category",
                            "note",
                            "tags",
                            "mapUrl",
                            "sourceUrl",
                            "price",
                            "preview",
                            "published",
                            "reviewedAt",
                            "artwork",
                          ];
                          setJson(
                            JSON.stringify(
                              Object.fromEntries(
                                Object.entries(place).filter(([key]) => keys.includes(key)),
                              ),
                              null,
                              2,
                            ),
                          );
                          setOpen(true);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              {tab === "Content" &&
                (data.content.length ? (
                  data.content.map((item) => (
                    <div className="admin-row" key={item.id}>
                      <div>
                        <strong>{item.title || item.slug}</strong>
                        <p className="muted small">
                          {item.section} / {item.kind}
                          {item.city ? " / " + item.city : ""}
                        </p>
                      </div>
                      <div className="button-row">
                        <Tag lime={item.status === "published"}>{item.status}</Tag>
                        <button
                          className="button small ghost"
                          onClick={() => {
                            const keys = [
                              "id",
                              "slug",
                              "kind",
                              "section",
                              "title",
                              "summary",
                              "body",
                              "sourceUrl",
                              "city",
                              "tags",
                              "status",
                              "featuredRank",
                            ];
                            setContentJson(
                              JSON.stringify(
                                Object.fromEntries(
                                  Object.entries(item).filter(([key]) => keys.includes(key)),
                                ),
                                null,
                                2,
                              ),
                            );
                            setMode("content");
                            setFormError(null);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="button small ghost"
                          onClick={() => void act("admin/content/delete", { id: item.id })}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="note">No entries yet. Add stories, playlists, and opportunities.</p>
                ))}
              {tab === "Members" &&
                data.users.map((user) => (
                  <div className="admin-row" key={user.id}>
                    <div>
                      <strong>{user.name}</strong>
                      <p className="muted small">{user.fixture ? "Demo account" : "Member"}</p>
                    </div>
                    <button
                      className="button ghost small"
                      onClick={() =>
                        void act("admin/users/suspend", { id: user.id, suspended: !user.suspended })
                      }
                    >
                      {user.suspended ? "Restore" : "Suspend"}
                    </button>
                  </div>
                ))}
              {tab === "Reports" &&
                (data.reports.length ? (
                  data.reports.map((report) => (
                    <div className="admin-row" key={report.id}>
                      <div>
                        <strong>{report.reason}</strong>
                        <p className="muted small">{report.status}</p>
                      </div>
                      {report.status === "open" && (
                        <button
                          className="button small ghost"
                          onClick={() => void act("admin/reports/resolve", { id: report.id })}
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="note">No reports.</p>
                ))}
              {tab === "Invoices" &&
                (data.invoices.length ? (
                  data.invoices.map((invoice) => (
                    <div className="admin-row" key={invoice.id}>
                      <div>
                        <strong>
                          {invoice.demo ? "Demo purchase" : "Membership purchase"} · $19
                        </strong>
                        <p className="muted small break-all">{invoice.id}</p>
                      </div>
                      <Tag>{invoice.status}</Tag>
                      {["submitted", "confirming", "review_required"].includes(invoice.status) && (
                        <button
                          className="button ghost small"
                          onClick={() => void act("admin/invoices/retry", { id: invoice.id })}
                        >
                          Retry verification
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="note">No invoices. There is no manual “mark paid” control.</p>
                ))}
            </div>
          </>
        )
      )}
      <Modal
        open={open}
        title={mode === "content" ? "Edit a content entry" : "Edit a reviewed place"}
        onClose={() => setOpen(false)}
      >
        <p className="muted small">
          {mode === "content"
            ? "Section is travel, art, music, or tech. Kind is story, playlist, opportunity, company, or perk. Status is draft, published, or archived."
            : "Alpha content editor. Use the import schema. Publication requires a real source and review date."}
        </p>
        <form onSubmit={add}>
          <label className="field">
            {mode === "content" ? "Content record" : "Place record"}
            <textarea
              rows={16}
              value={mode === "content" ? contentJson : json}
              onChange={(event) =>
                mode === "content"
                  ? setContentJson(event.target.value)
                  : setJson(event.target.value)
              }
              spellCheck={false}
            />
          </label>
          <ErrorBox error={formError} />
          <button className="button lime full">
            {mode === "content" ? "Save entry" : "Save place"} <Arrow />
          </button>
        </form>
      </Modal>
    </>
  );
}
