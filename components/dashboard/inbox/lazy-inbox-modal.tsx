"use client";

import dynamic from "next/dynamic";
import { useInbox } from "./inbox-context";

// Dynamic import with ssr: false ensures that the InboxModal bundle
// is only fetched over the wire when the modal is opened by the user.
const DynamicInboxModal = dynamic(
  () => import("./inbox-modal").then((mod) => mod.InboxModal),
  { ssr: false }
);

export function LazyInboxModal() {
  const { isInboxOpen } = useInbox();

  // If closed, avoid mounting and prevent downloading the inbox modal chunk
  if (!isInboxOpen) {
    return null;
  }

  return <DynamicInboxModal />;
}
