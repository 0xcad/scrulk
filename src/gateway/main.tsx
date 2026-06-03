import { render } from "preact";
import { Gateway } from "./Gateway";

const root = document.getElementById("root");
if (root) render(<Gateway />, root);
