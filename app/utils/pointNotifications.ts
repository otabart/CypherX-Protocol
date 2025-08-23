// Utility functions for handling point notifications and clever limit messages

export interface PointResponse {
  success: boolean;
  pointsEarned?: number;
  limitReached?: boolean;
  message?: string;
  newBalance?: number;
  dailyLimit?: number;
  currentCount?: number;
}

export const handlePointResponse = (response: PointResponse, addToast: (message: string, type: 'success' | 'error' | 'info') => void) => {
  if (response.success) {
    if (response.limitReached) {
      // Show universal limit message
      addToast(response.message || "Daily points limit reached", 'info');
    } else if (response.pointsEarned && response.pointsEarned > 0) {
      // Show points earned message
      addToast(response.message || `+${response.pointsEarned} points earned`, 'success');
    }
  } else {
    // Show error message
    addToast(response.message || "Something went wrong", 'error');
  }
};

// Universal limit message for reaching daily points maximum
export const getLimitMessage = (): string => {
  return "Daily points limit reached";
};

// Success message for earning points
export const getSuccessMessage = (_action: string, points: number): string => {
  return `+${points} points earned`;
};
