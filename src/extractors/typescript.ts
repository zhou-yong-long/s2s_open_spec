export interface InterfaceShape {
  name: string;
  kind: "function" | "route" | "constant";
  signature: string;
  file: string;
}
