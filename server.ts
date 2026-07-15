import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoint for Inventory Pro AI Assistant
  app.post("/api/inventory-pro/chat", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY is not configured in the application environment.",
          code: "MISSING_API_KEY"
        });
      }

      const { message, history, context } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message parameter is required." });
      }

      // Initialize the modern @google/genai SDK
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Assemble system instruction
      const systemInstruction = `You are "Inventory Pro", a sophisticated, friendly, and expert AI Chat Assistant integrated into Invenio—a professional dark-themed inventory management and analytics system.
Invenio specializes in archival asset control, sales (POS), production (BOM/Production Orders), procurement tracking, and movement diagnostics (fast, moderate, slow, or obsolete stock).

Your role:
1. Provide accurate, professional, and actionable inventory advice.
2. Formulate helpful restock proposals, sales tips, or warehouse reallocation strategies based on the current product metrics.
3. Help users draft emails to suppliers, restock instructions, order lists, or reports.
4. Keep answers clean, beautifully formatted in Markdown, and avoid dry, hyper-technical compiler jargon.
5. Emphasize visual clarity using bullet points, tables, and spacing. Do not make up facts or metrics that aren't provided in the context.

Current Database Context:
- Company Active Details: ${JSON.stringify(context?.company || { name: "Invenio Corp", currency: "$" })}
- Products currently loaded: ${context?.productsCount || 0} items
- Low Stock Items: ${JSON.stringify(context?.lowStock || [])}
- Alert States: ${JSON.stringify(context?.alerts || [])}
- Active Suppliers: ${context?.suppliersCount || 0}
- Active Customers: ${context?.customersCount || 0}
- MRO & Production State: ${JSON.stringify(context?.productionState || {})}
${context?.detailedSummary ? `- Comprehensive Inventory Catalog Overview:\n${context.detailedSummary}` : ""}

Be humble, conversational, and focus on practical workflows in Invenio. If the user asks you to perform database edits, remind them that you are an analytical assistant; explain they can review the list and use Invenio's dedicated forms to execute and audit those adjustments.`;

      // Build contents schema representing the chat history
      const formattedContents = [];

      // Append historical logs if available
      if (Array.isArray(history)) {
        for (const turn of history) {
          const role = turn.role === "user" ? "user" : "model";
          formattedContents.push({
            role: role,
            parts: [{ text: turn.text || turn.message || "" }]
          });
        }
      }

      // Add the final user message
      formattedContents.push({
        role: "user",
        parts: [{ text: message }]
      });

      // Call the generative model
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      const responseText = response.text || "I was unable to formulate a response. Please try reframing your query.";
      res.json({ text: responseText });

    } catch (error: any) {
      console.error("Gemini Assistant route failed:", error);
      res.status(500).json({ 
        error: error?.message || "An error occurred while communicating with the AI Assistant." 
      });
    }
  });

  // Vite middleware setup for running full-stack React + Vite
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server with Vite middleware running on http://localhost:${PORT}`);
  });
}

startServer();
