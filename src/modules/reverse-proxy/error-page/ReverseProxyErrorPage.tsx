import Button from "@components/Button";
import FancyToggleSwitch from "@components/FancyToggleSwitch";
import HelpText from "@components/HelpText";
import { Label } from "@components/Label";
import { Textarea } from "@components/Textarea";
import { FileCode2Icon, WandSparklesIcon } from "lucide-react";
import { useState } from "react";
import { ServiceErrorPage } from "@/interfaces/ReverseProxy";
import {
  byteLength,
  ERROR_PAGE_MAX_BYTES,
  ERROR_PAGE_PLACEHOLDERS,
  ERROR_PAGE_STARTER,
  renderErrorPagePreview,
  validateErrorPageHtml,
} from "@/modules/reverse-proxy/error-page/errorPage";

type Props = {
  value: ServiceErrorPage | undefined;
  onChange: (value: ServiceErrorPage | undefined) => void;
  onValidationChange?: (hasErrors: boolean) => void;
};

export const ReverseProxyErrorPage = ({
  value,
  onChange,
  onValidationChange,
}: Props) => {
  const [html, setHtml] = useState<string | undefined>(value?.html);

  // Every edit goes through here so the parent always holds the current page
  // and knows whether it can be saved.
  const commit = (next: string | undefined) => {
    setHtml(next);
    onChange(next === undefined ? undefined : { html: next });
    onValidationChange?.(
      next === undefined ? false : validateErrorPageHtml(next) !== "",
    );
  };

  const enabled = html !== undefined;
  const error = enabled ? validateErrorPageHtml(html) : "";
  const size = enabled ? byteLength(html) : 0;

  return (
    <div className={"flex flex-col gap-4"}>
      <FancyToggleSwitch
        value={enabled}
        onChange={(on) => commit(on ? ERROR_PAGE_STARTER : undefined)}
        label={
          <>
            <FileCode2Icon size={14} />
            Custom Error Page
          </>
        }
        helpText={
          "Show your own page instead of NetBird's when this service cannot be reached or is outside its schedule."
        }
        data-testid="toggle-error-page"
      />

      {enabled && (
        <div className={"flex flex-col gap-4"} data-testid="error-page-editor">
          <div>
            <Label>HTML</Label>
            <HelpText>
              A complete HTML document with inline styles. Scripts, forms and
              external stylesheets are blocked. Images load over https or as
              data URIs.
            </HelpText>
            <Textarea
              code
              rows={12}
              spellCheck={false}
              value={html}
              error={error}
              onChange={(e) => commit(e.target.value)}
              placeholder={"<!doctype html>..."}
              data-testid="error-page-html"
            />
            <div
              className={"flex items-center justify-between gap-3 mt-2"}
              data-testid="error-page-size"
            >
              <HelpText margin={false}>
                {ERROR_PAGE_PLACEHOLDERS.map((p) => p.token).join("  ")}
              </HelpText>
              <span
                className={
                  size > ERROR_PAGE_MAX_BYTES
                    ? "text-xs text-red-500 shrink-0"
                    : "text-xs text-nb-gray-400 shrink-0"
                }
              >
                {(size / 1024).toFixed(1)} / {ERROR_PAGE_MAX_BYTES / 1024} KB
              </span>
            </div>
            <Button
              variant={"dotted"}
              size={"sm"}
              className={"w-full mt-3"}
              onClick={() => commit(ERROR_PAGE_STARTER)}
              data-testid="error-page-starter"
            >
              <WandSparklesIcon size={14} />
              Start from the example page
            </Button>
          </div>

          {error === "" && (
            <div>
              <Label>Preview</Label>
              <HelpText>
                Shown with sample values, in a sandbox that blocks scripts just
                like the proxy does.
              </HelpText>
              <iframe
                title={"Error page preview"}
                sandbox={""}
                referrerPolicy={"no-referrer"}
                srcDoc={renderErrorPagePreview(html)}
                className={
                  "w-full h-[260px] rounded-md border border-nb-gray-700 bg-white"
                }
                data-testid="error-page-preview"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
