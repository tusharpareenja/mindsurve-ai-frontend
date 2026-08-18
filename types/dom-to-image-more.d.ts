declare module "dom-to-image-more" {
  const domtoimage: {
    toPng: (node: Node, options?: Record<string, unknown>) => Promise<string>
    toJpeg: (node: Node, options?: Record<string, unknown>) => Promise<string>
    toBlob: (node: Node, options?: Record<string, unknown>) => Promise<Blob>
    toSvg: (node: Node, options?: Record<string, unknown>) => Promise<string>
  }
  export default domtoimage
}
