import { renderToStaticMarkup } from "react-dom/server";
import {
  Button,
  Dialog,
  SearchField,
  Select,
  StudioUiProvider,
  TextField
} from "../../apps/studio/src/components/ui/index.js";

describe("Studio UI facade", () => {
  it("maps locale and color scheme through the root provider", () => {
    const markup = renderToStaticMarkup(
      <StudioUiProvider locale="zh-CN" colorScheme="dark">
        <Button isDisabled>保存</Button>
      </StudioUiProvider>
    );

    expect(markup).toContain('lang="zh-CN"');
    expect(markup).toContain("保存");
    expect(markup).toContain("disabled");
    expect(markup).toContain("studio-ui-root");
  });

  it("renders field labels, descriptions, and invalid state semantics", () => {
    const markup = renderToStaticMarkup(
      <StudioUiProvider locale="en-US" colorScheme="light">
        <>
          <TextField
            label="Project name"
            defaultValue="AGIDN"
            description="Used in the Studio title bar."
          />
          <TextField
            label="Repository name"
            defaultValue="AGIDN"
            errorMessage="Name is unavailable."
          />
        </>
      </StudioUiProvider>
    );

    expect(markup).toContain("Project name");
    expect(markup).toContain("Used in the Studio title bar.");
    expect(markup).toContain("Name is unavailable.");
    expect(markup).toContain('aria-invalid="true"');
  });

  it("rejects ambiguous TextField ownership", () => {
    expect(() => renderToStaticMarkup(
      <TextField label="Name" value="controlled" defaultValue="uncontrolled" />
    )).toThrow("TextField cannot be both controlled and uncontrolled.");
  });

  it("rejects action groups in dismissible dialogs", () => {
    expect(() => renderToStaticMarkup(
      <Dialog
        isOpen
        isDismissible
        title="Invalid dialog"
        actions={<Button>Continue</Button>}
        onDismiss={() => undefined}
      >
        Content
      </Dialog>
    )).toThrow("Dismissible dialogs cannot declare an action group.");
  });

  it("renders backend-neutral search and select semantics", () => {
    const markup = renderToStaticMarkup(
      <StudioUiProvider locale="en-US" colorScheme="dark">
        <>
          <SearchField label="Commands" isLabelHidden defaultValue="theme" />
          <Select
            label="Theme"
            defaultSelectedKey="dark"
            options={[
              { id: "light", label: "Light" },
              { id: "dark", label: "Dark" }
            ]}
          />
        </>
      </StudioUiProvider>
    );

    expect(markup).toContain('type="search"');
    expect(markup).toContain('aria-label="Commands"');
    expect(markup).toContain("Theme");
    expect(markup).toContain("Dark");
  });

  it("rejects ambiguous SearchField and Select ownership", () => {
    expect(() => renderToStaticMarkup(
      <SearchField label="Commands" value="theme" defaultValue="settings" />
    )).toThrow("SearchField cannot be both controlled and uncontrolled.");
    expect(() => renderToStaticMarkup(
      <Select
        label="Theme"
        selectedKey="dark"
        defaultSelectedKey="light"
        options={[]}
      />
    )).toThrow("Select cannot be both controlled and uncontrolled.");
  });
});
