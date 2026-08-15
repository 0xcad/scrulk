import { render } from "preact";
import { Gateway } from "../features/access-flow/gateway/Gateway";

const root = document.getElementById("root");
if (root) render(<Gateway />, root);
