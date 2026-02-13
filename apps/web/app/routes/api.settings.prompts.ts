import fs from "fs/promises";
import path from "path";

const DESCRIPTIONS: Record<string, string> = {
  "biz-review": "Business logic validation and requirements checking",
  "qa-review": "Quality assurance and test coverage analysis",
  "design-review": "UI/UX consistency and design pattern verification",
  "scrum-master": "Process facilitation and sprint management",
  "summarizer": "Content condensation and key point extraction",
};

export async function loader() {
  try {
    const promptsDir = path.resolve(process.cwd(), "../bot/src/prompts/v1");
    
    const files = await fs.readdir(promptsDir);
    const tsFiles = files.filter(f => f.endsWith(".ts"));

    const prompts = await Promise.all(
      tsFiles.map(async (file) => {
        const name = path.basename(file, ".ts");
        const content = await fs.readFile(path.join(promptsDir, file), "utf-8");
        
        return {
          name,
          version: "v1", 
          description: DESCRIPTIONS[name] || "No description available",
          content
        };
      })
    );

    return Response.json({ prompts });
  } catch (error) {
    console.error("Failed to load prompts:", error);
    throw new Response("Failed to load prompts", { status: 500 });
  }
}
