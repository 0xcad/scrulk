import { render } from "preact";
import { Survey } from "./Survey";

const root = document.getElementById("root");
if (root) render(<Survey />, root);
