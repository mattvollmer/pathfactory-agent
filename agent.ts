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
            description: "Find PathFactory experiences/experiments using filters like experience type or specific ID.",
            inputSchema: z.object({
              experience_id: z.number().optional().describe("Filter by specific experience ID"),
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
              limit: z.number().optional().default(50).describe("Maximum number of results to return")
            }),
            execute: async ({ 
              experience_id, 
              experience_type, 
              limit = 50 
            }) => {
              const apiKey = process.env.PATHFACTORY_KEY;
              if (!apiKey) {
                throw new Error("PATHFACTORY_KEY environment variable is required");
              }

              // Build query parameters
              const params = new URLSearchParams();
              if (experience_id) params.append("experience_id", experience_id.toString());
              if (experience_type) params.append("experience_type", experience_type);
              params.append("_format", "json");
              
              const url = `https://datalakeapi.pathfactory.com/public/v3/experiences/?${params.toString()}`;
              
              try {
                const response = await fetch(url, {
                  method: "GET",
                  headers: {
                    "access_token": apiKey,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                  }
                });

                if (!response.ok) {
                  throw new Error(`PathFactory API error: ${response.status} ${response.statusText}`);
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
          get_pageviews_by_content: {
            description: "Get pageview count and data for specific content by content ID or content UUID.",
            inputSchema: z.object({
              content_id: z.number().optional().describe("Filter pageviews by specific content ID"),
              content_uuid: z.string().optional().describe("Filter pageviews by content UUID"),
              campaign_id: z.string().optional().describe("Filter pageviews by campaign ID"),
              start_time_gte: z.string().optional().describe("Get pageviews from this date/time onwards (ISO format)"),
              start_time_lte: z.string().optional().describe("Get pageviews up to this date/time (ISO format)"),
              limit: z.number().optional().default(100).describe("Maximum number of pageviews to return")
            }),
            execute: async ({ 
              content_id, 
              content_uuid, 
              campaign_id,
              start_time_gte,
              start_time_lte,
              limit = 100 
            }) => {
              const apiKey = process.env.PATHFACTORY_KEY;
              if (!apiKey) {
                throw new Error("PATHFACTORY_KEY environment variable is required");
              }

              // Build query parameters
              const params = new URLSearchParams();
              if (content_id) params.append("content_id", content_id.toString());
              if (content_uuid) params.append("content_uuid", content_uuid);
              if (campaign_id) params.append("campaign_id", campaign_id);
              if (start_time_gte) params.append("start_time_gte", start_time_gte);
              if (start_time_lte) params.append("start_time_lte", start_time_lte);
              params.append("_format", "json");
              
              const url = `https://datalakeapi.pathfactory.com/public/v3/pageviews/?${params.toString()}`;
              
              try {
                const response = await fetch(url, {
                  method: "GET",
                  headers: {
                    "access_token": apiKey,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                  }
                });

                if (!response.ok) {
                  throw new Error(`PathFactory API error: ${response.status} ${response.statusText}`);
                }

                const jsonData = await response.json();
                
                // Debug: Log the actual response structure
                console.log("PathFactory Pageviews API Response:", JSON.stringify(jsonData, null, 2));
                
                // Handle different possible response structures
                let pageviews = [];
                if (jsonData && Array.isArray(jsonData)) {
                  // Direct array response
                  pageviews = jsonData;
                } else if (jsonData && jsonData.data && Array.isArray(jsonData.data)) {
                  // Wrapped in data property
                  pageviews = jsonData.data;
                } else if (jsonData && jsonData.pageviews && Array.isArray(jsonData.pageviews)) {
                  // Wrapped in pageviews property
                  pageviews = jsonData.pageviews;
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
                const limitedPageviews = pageviews.slice(0, limit);

                return {
                  success: true,
                  pageviews: limitedPageviews,
                  total_pageviews: pageviews.length,
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
- Get pageview counts and data for specific content by content ID or UUID
- Perform web searches for additional context
- Interact via Slack integration

When helping users with PathFactory-related tasks:
- Use the find_experiences tool to search for specific experiences by type, date, ID, or UUID
- Use the get_pageviews_by_content tool to analyze content performance and engagement metrics
- Provide clear, actionable information about experiences, content performance, and user engagement
- Help users understand their PathFactory data and optimize their content experiences

Always be helpful, accurate, and focused on PathFactory-related workflows and data analysis.`;
