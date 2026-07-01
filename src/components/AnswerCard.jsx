import ReactMarkdown from "react-markdown";

function AnswerCard({

    title,

    color,

    children

}){

    if(!children.trim()) return null;

    return(

        <div
            style={{

                background:"#0f172a",

                borderLeft:`6px solid ${color}`,

                borderRadius:"12px",

                padding:"22px",

                marginBottom:"25px"

            }}
        >

            <h3
                style={{

                    color,

                    marginBottom:"18px"

                }}
            >
                {title}
            </h3>

            <ReactMarkdown>

                {children}

            </ReactMarkdown>

        </div>

    );

}

export default AnswerCard;