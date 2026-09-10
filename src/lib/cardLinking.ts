interface LinkCardParams {
  userId: string;
  email: string;
  name?: string;
  onSuccess?: () => void;
  onError?: (err: any) => void;
}

export const launchCardLinkingModal = async ({
  onSuccess,
}: LinkCardParams) => {
  console.log("💳 Card linking modal redirected to crypto settlement.");
  if (onSuccess) onSuccess();
};
