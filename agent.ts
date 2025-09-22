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
          get_content_assets: {
            description: "Get PathFactory content assets by content ID, slug, UUID, or other filters.",
            inputSchema: z.object({
              content_id: z.number().optional().describe("Filter by specific content ID"),
              content_uuid: z.string().optional().describe("Filter by content UUID"),
              slug: z.string().optional().describe("Filter by content slug"),
              created_at_start: z.string().optional().describe("Filter content created from this date (ISO format)"),
              created_at_end: z.string().optional().describe("Filter content created until this date (ISO format)"),
              limit: z.number().optional().default(100).describe("Maximum number of assets to return (max 1000)"),
              offset: z.number().optional().default(0).describe("Offset for pagination")
            }),
            execute: async ({ 
              content_id, 
              content_uuid, 
              slug,
              created_at_start,
              created_at_end,
              limit = 100,
              offset = 0
            }) => {
              const apiKey = process.env.PATHFACTORY_KEY;
              if (!apiKey) {
                throw new Error("PATHFACTORY_KEY environment variable is required");
              }

              // Build query parameters
              const params = new URLSearchParams();
              if (content_id) params.append("content_id", content_id.toString());
              if (content_uuid) params.append("content_uuid", content_uuid);
              if (slug) params.append("slug", slug);
              if (created_at_start) params.append("created_at_start", created_at_start);
              if (created_at_end) params.append("created_at_end", created_at_end);
              params.append("limit", Math.min(limit, 1000).toString()); // Enforce API max
              params.append("offset", offset.toString());
              params.append("_format", "json");
              
              const url = `https://datalakeapi.pathfactory.com/public/v3/content_assets/?${params.toString()}`;
              
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
                console.log("PathFactory Content Assets API Response:", JSON.stringify(jsonData, null, 2));
                
                // Handle different possible response structures
                let contentAssets = [];
                if (jsonData && Array.isArray(jsonData)) {
                  // Direct array response
                  contentAssets = jsonData;
                } else if (jsonData && jsonData.data && Array.isArray(jsonData.data)) {
                  // Wrapped in data property
                  contentAssets = jsonData.data;
                } else if (jsonData && jsonData.content_assets && Array.isArray(jsonData.content_assets)) {
                  // Wrapped in content_assets property
                  contentAssets = jsonData.content_assets;
                } else {
                  // Unexpected format
                  return {
                    success: false,
                    error: "Unexpected API response format",
                    actual_response: jsonData,
                    url_attempted: url
                  };
                }

                return {
                  success: true,
                  content_assets: contentAssets,
                  total_found: contentAssets.length,
                  limit_used: Math.min(limit, 1000),
                  offset_used: offset,
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
          get_sessions: {
            description: "Get PathFactory visitor sessions with filtering by time, experience, visitor, or company data.",
            inputSchema: z.object({
              session_id: z.string().optional().describe("Filter by specific session ID"),
              visitor_id: z.number().optional().describe("Filter by visitor ID"),
              visitor_uuid: z.string().optional().describe("Filter by visitor UUID"),
              experience_id: z.number().optional().describe("Filter by experience ID"),
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
              campaign_id: z.string().optional().describe("Filter by campaign ID"),
              domain: z.string().optional().describe("Filter by domain"),
              company_name: z.string().optional().describe("Filter by company name"),
              start_time_gte: z.string().optional().describe("Get sessions from this date/time onwards (ISO format)"),
              start_time_lte: z.string().optional().describe("Get sessions up to this date/time (ISO format)"),
              limit: z.number().optional().default(100).describe("Maximum number of sessions to return (max 1000)"),
              offset: z.number().optional().default(0).describe("Offset for pagination")
            }),
            execute: async ({ 
              session_id,
              visitor_id, 
              visitor_uuid,
              experience_id,
              experience_type,
              campaign_id,
              domain,
              company_name,
              start_time_gte,
              start_time_lte,
              limit = 100,
              offset = 0
            }) => {
              const apiKey = process.env.PATHFACTORY_KEY;
              if (!apiKey) {
                throw new Error("PATHFACTORY_KEY environment variable is required");
              }

              // Build query parameters
              const params = new URLSearchParams();
              if (session_id) params.append("session_id", session_id);
              if (visitor_id) params.append("visitor_id", visitor_id.toString());
              if (visitor_uuid) params.append("visitor_uuid", visitor_uuid);
              if (experience_id) params.append("experience_id", experience_id.toString());
              if (experience_type) params.append("experience_type", experience_type);
              if (campaign_id) params.append("campaign_id", campaign_id);
              if (domain) params.append("domain", domain);
              if (company_name) params.append("company_name", company_name);
              if (start_time_gte) params.append("start_time_gte", start_time_gte);
              if (start_time_lte) params.append("start_time_lte", start_time_lte);
              params.append("limit", Math.min(limit, 1000).toString()); // Enforce API max
              params.append("offset", offset.toString());
              params.append("_format", "json");
              
              const url = `https://datalakeapi.pathfactory.com/public/v3/sessions/?${params.toString()}`;
              
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
                console.log("PathFactory Sessions API Response:", JSON.stringify(jsonData, null, 2));
                
                // Handle different possible response structures
                let sessions = [];
                if (jsonData && Array.isArray(jsonData)) {
                  // Direct array response
                  sessions = jsonData;
                } else if (jsonData && jsonData.data && Array.isArray(jsonData.data)) {
                  // Wrapped in data property
                  sessions = jsonData.data;
                } else if (jsonData && jsonData.sessions && Array.isArray(jsonData.sessions)) {
                  // Wrapped in sessions property
                  sessions = jsonData.sessions;
                } else {
                  // Unexpected format
                  return {
                    success: false,
                    error: "Unexpected API response format",
                    actual_response: jsonData,
                    url_attempted: url
                  };
                }

                return {
                  success: true,
                  sessions: sessions,
                  total_found: sessions.length,
                  limit_used: Math.min(limit, 1000),
                  offset_used: offset,
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
- Retrieve content assets by ID, UUID, slug, or creation date filters
- Analyze visitor sessions by time, experience, visitor, or company data
- Perform web searches for additional context
- Interact via Slack integration

When helping users with PathFactory-related tasks:
- Use the find_experiences tool to search for specific experiences by type, date, ID, or UUID
- Use the get_pageviews_by_content tool to analyze content performance and engagement metrics
- Use the get_content_assets tool to find and retrieve specific content assets and their details
- Use the get_sessions tool to analyze visitor behavior, session data, and engagement patterns
- Provide clear, actionable information about experiences, content performance, visitor behavior, and content management
- Help users understand their PathFactory data and optimize their content experiences

Always be helpful, accurate, and focused on PathFactory-related workflows and data analysis.`;
