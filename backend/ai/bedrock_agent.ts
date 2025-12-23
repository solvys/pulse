import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { BedrockAgentRuntimeClient, InvokeAgentCommand, RetrieveAndGenerateCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { secret } from "encore.dev/config";
import log from "encore.dev/log";

// Secrets for AWS
const awsAccessKeyId = secret("AWSAccessKeyId");
const awsSecretAccessKey = secret("AWSSecretAccessKey");
const awsRegion = secret("AWSRegion");
const bedrockAgentId = secret("BedrockAgentId");
const bedrockAgentAliasId = secret("BedrockAgentAliasId");
const bedrockKnowledgeBaseId = secret("BedrockKnowledgeBaseId");

/**
 * BedrockAgentClient handles interactions with Amazon Bedrock Agents.
 */
export class BedrockAgentClient {
  private agentClient: BedrockAgentRuntimeClient | null = null;
  private runtimeClient: BedrockRuntimeClient | null = null;

  constructor() {
    // Clients initialized lazily
  }

  private getClients() {
    if (this.agentClient && this.runtimeClient) {
      return { agent: this.agentClient, runtime: this.runtimeClient };
    }

    const credentials = {
      accessKeyId: awsAccessKeyId(),
      secretAccessKey: awsSecretAccessKey(),
    };
    const region = awsRegion();

    this.agentClient = new BedrockAgentRuntimeClient({
      region,
      credentials,
    });

    this.runtimeClient = new BedrockRuntimeClient({
      region,
      credentials,
    });

    return { agent: this.agentClient, runtime: this.runtimeClient };
  }

  /**
   * Invokes a Bedrock Agent with a user prompt and session ID.
   */
  async invokeAgent(prompt: string, sessionId: string): Promise<string> {
    const { agent } = this.getClients();
    
    const command = new InvokeAgentCommand({
      agentId: bedrockAgentId(),
      agentAliasId: bedrockAgentAliasId(),
      sessionId: sessionId,
      inputText: prompt,
    });

    try {
      const response = await agent.send(command);
      let completion = "";

      if (response.completion) {
        for await (const chunk of response.completion) {
          if (chunk.chunk && chunk.chunk.bytes) {
            completion += new TextDecoder().decode(chunk.chunk.bytes);
          }
        }
      }

      return completion;
    } catch (error) {
      log.error("Error invoking Bedrock agent", { error, sessionId });
      throw error;
    }
  }

  async retrieveAndGenerate(prompt: string, sessionId?: string): Promise<string> {
    const { agent } = this.getClients();
    const region = awsRegion();
    const modelArn = `arn:aws:bedrock:${region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`;
    
    const command = new RetrieveAndGenerateCommand({
      input: { text: prompt },
      retrieveAndGenerateConfiguration: {
        type: "KNOWLEDGE_BASE",
        knowledgeBaseConfiguration: {
          knowledgeBaseId: bedrockKnowledgeBaseId(),
          modelArn: modelArn,
        },
      },
      sessionId: sessionId,
    });

    try {
      const response = await agent.send(command);
      return response.output?.text || "No information found in Knowledge Base.";
    } catch (error) {
      log.error("Error invoking Bedrock Knowledge Base RAG", { error, sessionId });
      return "I was unable to consult the Knowledge Base at this time.";
    }
  }

  /**
   * Directly invokes a Bedrock model (fallback or specific logic).
   */
  async invokeModel(prompt: string, modelId: string = "anthropic.claude-3-sonnet-20240229-v1:0"): Promise<string> {
    const { runtime } = this.getClients();

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: body,
    });

    try {
      const response = await runtime.send(command);
      const result = JSON.parse(new TextDecoder().decode(response.body));
      return result.content[0].text;
    } catch (error) {
      log.error("Error invoking Bedrock model", { error, modelId });
      throw error;
    }
  }
}

// Export a singleton instance
export const bedrock = new BedrockAgentClient();
