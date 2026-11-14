import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// DialogContent and SheetContent draw a close X in the top corner. Content that
// draws its own close or back control must pass hideClose, or people see two.
const CLOSE_HANDLER =
  /onClick=\{\s*(?:\(\)\s*=>\s*)?(?:\w*[Oo]pen\w*\(false\)|on[A-Z]?\w*Close\w*|handleClose\w*|close\w*|requestClose\w*)/;
const CLOSE_LABEL = /aria-label="(?:Close|Back)\b/;
const CLOSE_PRIMITIVE = /<(?:Dialog|Sheet)Close\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

export function overlaysWithTwoCloses(source: string): string[] {
  const found: string[] = [];
  const open = /<(Dialog|Sheet)Content\b((?:[^>]|=>)*?)>/g;
  for (let tag = open.exec(source); tag; tag = open.exec(source)) {
    const end = source.indexOf(`</${tag[1]}Content>`, tag.index);
    if (end < 0) continue;
    const props = tag[2];
    if (/\bhideClose\b/.test(props)) continue;
    const body = source.slice(tag.index + tag[0].length, end);
    const controls = body.match(/<(button|Button|DialogClose|SheetClose)\b[\s\S]*?<\/\1>/g) ?? [];
    const own = controls.find(
      (control) =>
        CLOSE_LABEL.test(control) ||
        CLOSE_PRIMITIVE.test(control) ||
        (CLOSE_HANDLER.test(control) && /<(X|ArrowLeft|ChevronLeft)\b/.test(control)),
    );
    if (own) found.push(`${tag[1]}Content line ${source.slice(0, tag.index).split("\n").length}`);
  }
  return found;
}

test("an overlay with its own close control hides the built-in X", () => {
  assert.deepEqual(
    overlaysWithTwoCloses(`<DialogContent><button aria-label="Close post" onClick={onClose}><X /></button></DialogContent>`),
    ["DialogContent line 1"],
  );
  assert.deepEqual(
    overlaysWithTwoCloses(`<SheetContent side="bottom">\n<button onClick={() => onOpenChange(false)}><X /></button></SheetContent>`),
    ["SheetContent line 1"],
  );
  assert.deepEqual(
    overlaysWithTwoCloses(`<SheetContent hideClose><button aria-label="Close tools" onClick={() => onOpenChange(false)}><X /></button></SheetContent>`),
    [],
  );
  // Removing an image or a tag is not a close control.
  assert.deepEqual(
    overlaysWithTwoCloses(`<DialogContent><Button onClick={removeImage}><X /></Button></DialogContent>`),
    [],
  );
});

test("no screen shows two close buttons", () => {
  const offenders = sourceFiles("src")
    .filter((file) => !file.includes(join("components", "ui")))
    .flatMap((file) => overlaysWithTwoCloses(readFileSync(file, "utf8")).map((where) => `${file}: ${where}`));
  assert.deepEqual(offenders, []);
});

test("nothing hides the built-in close with a CSS selector", () => {
  const hacks = sourceFiles("src").filter((file) =>
    /<(?:Dialog|Sheet)Content\b[^>]*\[&>button\]:hidden/.test(readFileSync(file, "utf8")),
  );
  assert.deepEqual(hacks, []);
});
