import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import helpContent from "../docs/Help.md?raw";
import "./Help.css";

const Help = () => {
    return (
        <div className="help-page" style={{ padding: "1rem", maxWidth: "1200px", margin: "auto" }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{helpContent}</ReactMarkdown>
        </div>
    );
};

export default Help;