import { describe, expect, it } from "vitest";
import { contentDisposition, forwardedRange } from "./video-stream";

describe("video streaming", () => {
  it.each(["bytes=0-", "bytes=0-1023", "bytes=-1024", "bytes=0-99, 200-299"])(
    "forwards a valid byte range: %s",
    (range) => expect(forwardedRange(range)).toBe(range),
  );

  it.each(["items=0-10", "bytes=abc-def", "bytes=", "bytes=0-1\r\nx-test: yes"])(
    "rejects an invalid byte range: %s",
    (range) => expect(forwardedRange(range)).toBeNull(),
  );

  it("sanitizes filenames used in download headers", () => {
    expect(contentDisposition('demo"video\\final.mp4')).toBe('attachment; filename="demo-video-final.mp4"');
  });
});