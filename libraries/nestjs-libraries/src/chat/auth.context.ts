import { getAuth, getScope } from '@gitroom/nestjs-libraries/chat/async.storage';

export const checkAuth = (
  inputData: any,
  context: any
) => {
  const auth = getAuth();
  const authInfo = context?.mcp?.extra?.authInfo || auth;
  if (authInfo && context?.requestContext) {
    (context.requestContext as any).set(
      'organization',
      JSON.stringify(authInfo)
    );
    (context.requestContext as any).set('ui', 'false');
  }
};

// A connection with an MCP access key can be limited to some channels
export const isIntegrationAllowed = (integrationId?: string | null) => {
  const ids = getScope()?.integrationIds;
  return !ids?.length || (!!integrationId && ids.includes(integrationId));
};

export const assertIntegrationAllowed = (integrationId?: string | null) => {
  if (!isIntegrationAllowed(integrationId)) {
    throw new Error('This access key has no access to this channel');
  }
};
