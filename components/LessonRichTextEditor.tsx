
"use client";

import { useRef } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function LessonRichTextEditor({
  value,
  onChange,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);

  function format(command: string, commandValue?: string) {
    editorRef.current?.focus();

    document.execCommand(command, false, commandValue);

    onChange(editorRef.current?.innerHTML || "");
  }

  function changeSize(size: string) {
    format("fontSize", size);
  }

  function changeColor(color: string) {
    if (!color) return;
    format("foreColor", color);
  }

  return (
    <div className="lesson-editor">
      <div className="lesson-editor-toolbar">
        {/* Text formatting */}
        <button
          type="button"
          onClick={() => format("bold")}
          title="Bold"
        >
          <b>B</b>
        </button>

        <button
          type="button"
          onClick={() => format("italic")}
          title="Italic"
        >
          <i>I</i>
        </button>

        <button
          type="button"
          onClick={() => format("underline")}
          title="Underline"
        >
          <u>U</u>
        </button>

        <span className="lesson-editor-divider" />

        {/* Font size */}
        <select
          defaultValue="3"
          aria-label="Font size"
          onChange={(e) => changeSize(e.target.value)}
        >
          <option value="1">10 pt</option>
          <option value="2">13 pt</option>
          <option value="3">16 pt</option>
          <option value="4">18 pt</option>
          <option value="5">24 pt</option>
          <option value="6">32 pt</option>
          <option value="7">48 pt</option>
        </select>

        {/* Text color */}
        <select
          defaultValue=""
          aria-label="Text color"
          onChange={(e) => {
            changeColor(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Text color
          </option>
          <option value="#222222">Black</option>
          <option value="#7b3f78">Purple</option>
          <option value="#b83232">Red</option>
          <option value="#2463a6">Blue</option>
          <option value="#23834b">Green</option>
        </select>

        <span className="lesson-editor-divider" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => format("insertUnorderedList")}
          title="Bulleted list"
        >
          • List
        </button>

        <button
          type="button"
          onClick={() => format("insertOrderedList")}
          title="Numbered list"
        >
          1. List
        </button>

        <span className="lesson-editor-divider" />

        {/* Text alignment */}
        <button
          type="button"
          onClick={() => format("justifyLeft")}
          title="Align left"
        >
          Left
        </button>

        <button
          type="button"
          onClick={() => format("justifyCenter")}
          title="Align center"
        >
          Center
        </button>

        <button
          type="button"
          onClick={() => format("justifyRight")}
          title="Align right"
        >
          Right
        </button>

        <button
          type="button"
          onClick={() => format("justifyFull")}
          title="Justify"
        >
          Justify
        </button>
      </div>

      {/* Editable lesson area */}
      <div
        ref={editorRef}
        className="lesson-editor-content"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Lesson content"
        aria-multiline="true"
        data-placeholder="Write your lesson here..."
        onInput={(e) =>
          onChange(e.currentTarget.innerHTML)
        }
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  );
}
