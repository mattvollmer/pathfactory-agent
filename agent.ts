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

const system = `You are Pathfactory`;
