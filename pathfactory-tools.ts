import { z } from "zod";

interface PathFactoryExperience {
  experience_id: number;
  experience_uuid: string;
  experience_type: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
  // Add more fields as needed based on actual API response
}

interface PathFactoryResponse {
  data: PathFactoryExperience[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
  };
}

export const pathfactoryTools = {
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
    }: {
      created_at_min?: string;
      created_at_max?: string;
      experience_id?: number;
      experience_uuid?: string;
      experience_type?: string;
      format?: string;
      limit?: number;
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
            "Authorization": `Bearer ${apiKey}`,
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

        const jsonData: PathFactoryResponse = await response.json();
        
        // Apply client-side limit if needed
        const limitedData = {
          ...jsonData,
          data: jsonData.data.slice(0, limit)
        };

        return {
          success: true,
          experiences: limitedData.data,
          total_found: jsonData.data.length,
          limited_to: limit,
          pagination: jsonData.pagination
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          url_attempted: url
        };
      }
    }
  }
};
