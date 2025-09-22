import * as slackbot from "@blink-sdk/slackbot";
import * as search from "@blink-sdk/web-search";
import { convertToModelMessages, streamText } from "ai";
import blink from "blink";
import { z } from "zod";
import withModelIntent from "@blink-sdk/model-intent";
import { pathfactoryTools } from "./pathfactory-tools.js";

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
          ...pathfactoryTools,
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
