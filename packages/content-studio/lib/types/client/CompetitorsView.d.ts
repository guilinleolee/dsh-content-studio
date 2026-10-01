import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { CompetitorAnalyzeWorkRequest, CompetitorAnalyzeWorkResult, CompetitorManifest, CompetitorManifestRead, CompetitorReportRequest, CompetitorReportResult, ContentOutputsSnapshot } from '@deepseek-ai/dsh-content-outputs/types';
import type { TopicBankGateway } from './TopicBankView.tsx';
/** Injected face of the competitors view: the Remote wrappers it needs. */
export interface CompetitorsViewInjected {
    /** The topic-bank face the 收录为选题 push rides. */
    topics: TopicBankGateway;
    listOutputs: () => Promise<ContentOutputsSnapshot>;
    readCompetitorManifest: (theme: string) => Promise<CompetitorManifestRead>;
    writeCompetitorManifest: (theme: string, manifest: CompetitorManifest) => Promise<void>;
    writeAsset: (write: {
        theme: string;
        file: string;
        content: string;
    }) => Promise<{
        truncated: boolean;
    }>;
    deleteAsset: (theme: string, file: string) => Promise<void>;
    readAsset: (theme: string, file: string) => Promise<{
        content?: string;
    }>;
    analyzeCompetitorWork: (request: CompetitorAnalyzeWorkRequest) => Promise<CompetitorAnalyzeWorkResult>;
    generateCompetitorReport: (request: CompetitorReportRequest) => Promise<CompetitorReportResult>;
}
/** Full view props: the injected face plus the locale seat. */
export type CompetitorsViewProps = CompetitorsViewInjected & PropsLocale<'content-studio'>;
/**
 * Render the competitors view.
 * @param props - the injected face and the locale seat.
 * @returns the view element tree.
 */
export declare function CompetitorsView(props: CompetitorsViewProps): import("react").JSX.Element;
//# sourceMappingURL=CompetitorsView.d.ts.map