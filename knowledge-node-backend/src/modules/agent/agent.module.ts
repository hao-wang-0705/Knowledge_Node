import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { NodesModule } from '../nodes/nodes.module';
import { AgentController } from './agent.controller';
import { AgentGateway } from './agent.gateway';
import { IntentAnalyzer } from './analyzer/intent.analyzer';
import { PlanGenerator } from './analyzer/plan.generator';
import { TaskExecutor } from './executor/task.executor';
import { ChainExecutor } from './executor/chain.executor';
import { ToolRegistry } from './tools/tool.registry';

// 工具导入
import { TextGenerateTool } from './tools/text-generate.tool';
import { WebSearchTool } from './tools/web-search.tool';
import { SummarizeTool } from './tools/summarize.tool';
import { ExpandTool } from './tools/expand.tool';
import { ShouldSuggestDeconstructTool } from './tools/should-suggest-deconstruct.tool';
import { AggregateTool } from './tools/aggregate.tool';
import { SearchNLParseTool } from './tools/search-nl-parse.tool';
// v5.0: 新工具
import { ImageRecognizeTool } from './tools/image-recognize.tool';
import { VoiceRecognizeTool } from './tools/voice-recognize.tool';
import { SmartStructureTool } from './tools/smart-structure.tool';
// 向后兼容：保留旧工具
import { TranscribeTool } from './tools/transcribe.tool';
import { CaptureTool } from './tools/capture.tool';
import { SmartCaptureTool } from './tools/smart-capture.tool';
import { SmartDeconstructTool } from './tools/smart-deconstruct.tool';

const createToolRegistry = () => {
  const registry = new ToolRegistry();
  // 基础工具
  registry.register(new TextGenerateTool());
  registry.register(new WebSearchTool());
  registry.register(new SummarizeTool());
  registry.register(new ExpandTool());
  // v5.0: 新工具（优先注册）
  registry.register(new ImageRecognizeTool());
  registry.register(new VoiceRecognizeTool());
  registry.register(new SmartStructureTool());
  // 辅助工具
  registry.register(new ShouldSuggestDeconstructTool());
  registry.register(new AggregateTool());
  registry.register(new SearchNLParseTool());
  // 向后兼容：保留旧工具注册（优先级低于新工具）
  registry.register(new TranscribeTool(), -1);
  registry.register(new CaptureTool(), -1);
  registry.register(new SmartCaptureTool(), -1);
  registry.register(new SmartDeconstructTool(), -1);
  return registry;
};

@Module({
  imports: [ConfigModule, PrismaModule, NodesModule],
  controllers: [AgentController],
  providers: [
    // 工具注册中心（需要先注册，因为其他服务依赖它）
    {
      provide: ToolRegistry,
      useFactory: createToolRegistry,
    },
    // 分析器
    IntentAnalyzer,
    PlanGenerator,
    // 执行器
    TaskExecutor,
    ChainExecutor,
    // 网关服务
    AgentGateway,
  ],
  exports: [AgentGateway, ToolRegistry],
})
export class AgentModule {}
