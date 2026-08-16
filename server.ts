import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API endpoint for Dynamic Business Insights
  app.post("/api/insights/generate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured.",
          code: "MISSING_API_KEY"
        });
      }

      const { snapshot, currency = "KSh" } = req.body;
      if (!snapshot) {
        return res.status(400).json({ error: "Missing data snapshot payload." });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `You are the Elite Chief Inventory & Revenue Intelligence Analyst for Invenio—an advanced enterprise inventory and sales management system.
Your objective: Analyze the real-time business snapshot and generate sharp, highly actionable, executive-grade insights for each designated UI location.

Rules & Thresholds:
- Speak directly, decisively, and concisely.
- Format: 1-2 sentences per insight, verb-first, data-backed with exact numbers and metrics from the snapshot.
- Currency to reference: "${currency}".
- Never use generic placeholder phrases. Every insight must refer to real figures, SKUs, or category names from the snapshot.
- Severity Assignment:
  - 'red': Critical risks (e.g. stockout in <3 days on top revenue driver, negative margin, dead capital lockup, high at-risk SKU count).
  - 'yellow': Opportunities or warnings requiring attention (e.g. reorders needed within 7-14 days, margin compression, high SKU aging >90 days, uneven ABC concentration).
  - 'green': Strong performance or positive momentum (e.g. healthy turnover >3x, sell-through >60%, high-margin winners driving revenue, optimal stock coverage).
  - 'neutral': Informational status, balanced equilibrium, or baseline operations.

Output Format:
You MUST provide an entry in "insights" for all 16 fixed UI element IDs:
1. 'dashboard_executive_kpis' - Executive health / Top-line revenue & profit insight badge
2. 'dashboard_stock_alert' - Low stock & critical stockout horizon insight badge
3. 'dashboard_activity_overview' - Daily movement velocity & revenue trend insight badge
4. 'inventory_valuation_health' - Inventory value, capital lock-up & dead stock insight badge
5. 'inventory_stock_distribution' - Overstocked vs critical low stock balance insight badge
6. 'inventory_sku_aging' - Slow moving & aging SKU risk breakdown insight badge
7. 'demand_forecast_velocity' - Sales velocity, burn rate & spike forecast insight badge
8. 'demand_reorder_urgency' - Immediate purchase order / reorder prioritization badge
9. 'demand_stockout_risk' - Stockout horizon bucket warning (0-3d / 7d / 14d) badge
10. 'analytics_turnover_efficiency' - Stock turnover ratio & inventory velocity insight badge
11. 'analytics_sell_through' - Sell-through performance & liquidation pace insight badge
12. 'analytics_abc_capital' - ABC capital allocation Pareto distribution insight badge
13. 'profit_gross_margin' - Net margin & COGS optimization opportunities insight badge
14. 'profit_expense_impact' - Operational expense drain vs revenue margin insight badge
15. 'sales_revenue_growth' - Sales growth momentum, basket size & volume insight badge
16. 'sales_top_performers' - Top revenue drivers & Pareto concentration insight badge`;

      const promptPayload = `Analyze this real-time inventory and financial snapshot and generate structured insights for all 16 UI locations:\n\n${JSON.stringify(snapshot, null, 2)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: promptPayload,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    elementId: {
                      type: Type.STRING,
                      description: "One of the 16 fixed UI element IDs",
                    },
                    severity: {
                      type: Type.STRING,
                      enum: ["green", "yellow", "red", "neutral"],
                      description: "Severity level for the insight badge",
                    },
                    text: {
                      type: Type.STRING,
                      description: "1-2 sentences, verb-first, data-backed insight",
                    },
                    relatedSku: {
                      type: Type.STRING,
                      nullable: true,
                      description: "Associated product SKU or null",
                    },
                  },
                  required: ["elementId", "severity", "text"],
                },
              },
            },
            required: ["insights"],
          },
          temperature: 0.3,
        }
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText);
      return res.json(parsed);

    } catch (error: any) {
      console.error("Gemini Insights generation route failed:", error);
      return res.status(500).json({
        error: error?.message || "Failed to generate dynamic insights via Gemini API."
      });
    }
  });

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
