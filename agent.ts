import * as slackbot from "@blink-sdk/slackbot";
import * as search from "@blink-sdk/web-search";
import { convertToModelMessages, streamText } from "ai";
import blink from "blink";
import { z } from "zod";
import withModelIntent from "@blink-sdk/model-intent";

export default blink.agent({
  async sendMessages({ messages, abortSignal }) {
    return streamText({
      model: "anthropic/claude-sonnet-4",
      system,
      messages: convertToModelMessages(messages),
      tools: withModelIntent(
        {
          ...slackbot.tools({
            messages,
          }),
          search_web: search.tools.web_search,
          find_experiences: {
            description: "Find PathFactory experiences/experiments using various filters like creation date, experience type, or specific IDs.",
            inputSchema: z.object({
              created_at_min: z.string().optional().describe("Minimum creation date filter (ISO format)"),
              created_at_max: z.string().optional().describe("Maximum creation date filter (ISO format)"),
              experience_id: z.number().optional().describe("Filter by specific experience ID"),
              experience_uuid: z.string().optional().describe("Filter by experience UUID"),
              experience_type: z.enum([
                "target",
                "recommend", 
                "website",
                "virtual_event",
                "microsite",
                "templated_experience",
                "chatfactory",
                "website_tools"
              ]).optional().describe("Filter by experience type"),
              format: z.enum(["json", "csv"]).optional().default("json").describe("Response format"),
              limit: z.number().optional().default(50).describe("Maximum number of results to return")
            }),
            execute: async ({ 
              created_at_min, 
              created_at_max, 
              experience_id, 
              experience_uuid, 
              experience_type, 
              format = "json",
              limit = 50 
            }) => {
              const apiKey = process.env.PATHFACTORY_KEY;
              if (!apiKey) {
                throw new Error("PATHFACTORY_KEY environment variable is required");
              }

              // Build query parameters
              const params = new URLSearchParams();
              if (created_at_min) params.append("created_at_min", created_at_min);
              if (created_at_max) params.append("created_at_max", created_at_max);
              if (experience_id) params.append("experience_id", experience_id.toString());
              if (experience_uuid) params.append("experience_uuid", experience_uuid);
              if (experience_type) params.append("experience_type", experience_type);
              if (format) params.append("_format", format);
              
              const url = `https://datalakeapi.pathfactory.com/public/v3/experiences/?${params.toString()}`;
              
              try {
                const response = await fetch(url, {
                  method: "GET",
                  headers: {
                    "access_token": apiKey,
                    "Content-Type": "application/json",
                    "Accept": format === "csv" ? "text/csv" : "application/json"
                  }
                });

                if (!response.ok) {
                  throw new Error(`PathFactory API error: ${response.status} ${response.statusText}`);
                }

                if (format === "csv") {
                  const csvData = await response.text();
                  return {
                    success: true,
                    data: csvData,
                    format: "csv"
                  };
                }

                const jsonData = await response.json();
                
                // Debug: Log the actual response structure
                console.log("PathFactory API Response:", JSON.stringify(jsonData, null, 2));
                
                // Handle different possible response structures
                let experiences = [];
                if (jsonData && Array.isArray(jsonData)) {
                  // Direct array response
                  experiences = jsonData;
                } else if (jsonData && jsonData.data && Array.isArray(jsonData.data)) {
                  // Wrapped in data property
                  experiences = jsonData.data;
                } else if (jsonData && jsonData.experiences && Array.isArray(jsonData.experiences)) {
                  // Wrapped in experiences property
                  experiences = jsonData.experiences;
                } else {
                  // Unexpected format
                  return {
                    success: false,
                    error: "Unexpected API response format",
                    actual_response: jsonData,
                    url_attempted: url
                  };
                }
                
                // Apply client-side limit if needed
                const limitedExperiences = experiences.slice(0, limit);

                return {
                  success: true,
                  experiences: limitedExperiences,
                  total_found: experiences.length,
                  limited_to: limit,
                  pagination: jsonData.pagination || null,
                  raw_response_keys: Object.keys(jsonData || {})
                };
              } catch (error) {
                return {
                  success: false,
                  error: error instanceof Error ? error.message : "Unknown error occurred",
                  url_attempted: url
                };
              }
            }
          },
        },
        {
          onModelIntents(modelIntents) {
            if (abortSignal?.aborted) {
              return;
            }
            const metadata = slackbot.findLastMessageMetadata(messages);
            if (!metadata) {
              return;
            }
            let statuses = modelIntents.map((i) => {
              let displayIntent = i.modelIntent;
              if (displayIntent.length > 0) {
                displayIntent =
                  displayIntent.charAt(0).toLowerCase() +
                  displayIntent.slice(1);
              }
              return displayIntent;
            });
            statuses = [...new Set(statuses)];
            slackbot
              .createClient(metadata)
              .then((client) => {
                if (abortSignal?.aborted) {
                  return;
                }
                return client.assistant.threads.setStatus({
                  channel_id: metadata.channel,
                  thread_ts: metadata.ts,
                  status: `is ${statuses.join(", ")}...`,
                });
              })
              .catch(() => {
                // Ignore
              });
          },
        }
      ),
    });
  },
  async webhook(request) {
    if (slackbot.isOAuthRequest(request)) {
      return slackbot.handleOAuthRequest(request);
    }
    if (slackbot.isWebhook(request)) {
      return slackbot.handleWebhook(request);
    }
  },
});

const system = `You are PathFactory, an AI assistant specialized in helping users work with PathFactory's platform and data.

You have access to tools that can:
- Search and find PathFactory experiences/experiments using various filters
- Perform web searches for additional context
- Interact via Slack integration

When helping users with PathFactory-related tasks:
- Use the find_experiences tool to search for specific experiences by type, date, ID, or UUID
- Provide clear, actionable information about experiences and experiments
- Help users understand their PathFactory data and optimize their content experiences

Always be helpful, accurate, and focused on PathFactory-related workflows and data analysis.`;
