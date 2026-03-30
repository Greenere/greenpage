import React from "react";

export const Title: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h1
    style={{
      fontSize: "1rem",
      fontWeight: 700,
      marginBottom: "0.5em",
      color: "#111827",
      lineHeight: 1.2,
    }}
  >
    {children}
  </h1>
);

export const Subtitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: "0.8rem",
      fontWeight: 600,
      color: `var(--color-text)`,
    }}
  >
    {children}
  </div>
);

export const Paragraph: React.FC<{ style?: Record<string, unknown>, children: React.ReactNode }> = ({
  children,
  style
}) => (
  <div
    style={{
      color: `var(--color-text)`,
      fontSize: "0.5rem",
      lineHeight: 1.1,
      paddingLeft: "0.5rem",
      paddingRight: "0.5rem",
      textAlign: "justify",
      textJustify: "inter-word",
      ...style
    }}
  >
    {children}
  </div>
);

export const Footnote: React.FC<{ style?: Record<string, unknown>, children: React.ReactNode }> = ({
  style,
  children }) => (
  <div
    style={{
      color: `var(--color-text)`,
      fontSize: "0.3rem",
      lineHeight: 1,
      ...style
    }}
  >
    {children}
  </div>
);

export const Quote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <blockquote
    style={{
      borderLeft: "4px solid #3b82f6",
      paddingLeft: "1em",
      fontStyle: "italic",
      color: "#4b5563",
      margin: "1.5em 0",
    }}
  >
    {children}
  </blockquote>
);

export const CodeBlock: React.FC<{ children: string }> = ({ children }) => (
  <pre
    style={{
      background: "#111827",
      color: "#f9fafb",
      padding: "1em",
      borderRadius: "10px",
      fontFamily: "Menlo, Monaco, monospace",
      overflowX: "auto",
      fontSize: "0.9rem",
      margin: "1.5em 0",
    }}
  >
    <code>{children}</code>
  </pre>
);

interface ImageBlockProps {
  src: string;
  alt: string;
  caption?: string;
}

export const ImageBlock: React.FC<ImageBlockProps> = ({ src, alt, caption }) => (
  <figure style={{ margin: "2em 0", textAlign: "center" }}>
    <img
      src={src}
      alt={alt}
      style={{
        width: "100%",
        borderRadius: "16px",
        boxShadow: "0 6px 16px rgba(0,0,0,0.1)",
        objectFit: "cover",
      }}
    />
    {caption && (
      <figcaption style={{ fontSize: "0.9rem", color: "#6b7280", marginTop: "0.5em" }}>
        {caption}
      </figcaption>
    )}
  </figure>
);
