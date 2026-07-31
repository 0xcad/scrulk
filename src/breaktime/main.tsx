import { render } from "preact";
import { BreaktimeChallenge } from "./BreaktimeChallenge";
import "./breaktime.css";

const root = document.getElementById("root");
if (root) render(<BreaktimeChallenge />, root);
