import { authenticateServiceRequest, type ServiceAuthenticationResult } from "@/lib/integrations/serviceAuth";

/**
 * Authenticates the OtmanAccounting app: its own key (`ACCOUNTING_API_KEY`),
 * never the MCP one, for the same fixed company as the MCP integration.
 */
export function authenticateAccountingRequest(request: Request): ServiceAuthenticationResult {
  return authenticateServiceRequest(request, {
    apiKey: process.env.ACCOUNTING_API_KEY,
    companyId: process.env.OTMAN_API_COMPANY_ID,
  });
}
