import { authenticateServiceRequest, type ServiceAuthenticationResult } from "@/lib/integrations/serviceAuth";

export type McpServiceAuthenticationResult = ServiceAuthenticationResult;

export function authenticateMcpRequest(
  request: Request,
): McpServiceAuthenticationResult {
  return authenticateServiceRequest(request, {
    apiKey: process.env.OTMAN_API_KEY,
    companyId: process.env.OTMAN_API_COMPANY_ID,
  });
}
