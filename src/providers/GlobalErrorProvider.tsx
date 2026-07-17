import React, { createContext, useContext, useState, ReactNode, Component, ErrorInfo, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform } from 'react-native';

interface GlobalErrorOptions {
  message?: string;
  error?: any;
}

interface GlobalErrorContextType {
  showError: (options?: GlobalErrorOptions) => void;
}

export const GlobalErrorContext = createContext<GlobalErrorContextType | null>(null);

export let globalShowError: (options?: GlobalErrorOptions) => void = () => {
  console.warn("GlobalErrorProvider is not mounted yet.");
};

export const useGlobalError = () => {
  const context = useContext(GlobalErrorContext);
  if (!context) {
    throw new Error('useGlobalError must be used within a GlobalErrorProvider');
  }
  return context;
};

// React Error Boundary to catch render errors
class GlobalErrorBoundary extends Component<{ children: ReactNode; showError: (opts: GlobalErrorOptions) => void }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; showError: (opts: GlobalErrorOptions) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (__DEV__) {
      console.error("React Error Boundary Caught:", error, errorInfo);
    } else {
      console.error("React Error Boundary Caught:", error);
    }
    // We cannot reliably call hook-based showError from within componentDidCatch without risking infinite loops if the error is unrecoverable,
    // but we manage our own degraded state.
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI if React tree crashes
      return (
        <View style={styles.fallbackContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sorry for the inconvenience</Text>
            <Text style={styles.modalDescription}>
              Something went wrong while processing your request.{"\n\n"}
              Please try again in a moment.{"\n"}
              If the problem continues, please restart the application or try again later.
            </Text>
            <Pressable style={styles.closeButton} onPress={() => this.setState({ hasError: false })}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

export const GlobalErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const showError = (options?: GlobalErrorOptions) => {
    if (isOpen) return; // Prevent stacking
    
    if (__DEV__ && options?.error) {
      console.error("GlobalErrorProvider:", options.error);
    } else if (!__DEV__ && options?.error) {
      // Internal logging only
      console.error("Global Error (Production):", options.error);
    }

    setIsOpen(true);
  };

  globalShowError = showError;

  useEffect(() => {
    // Catch unhandled Promise rejections and global errors
    if (Platform.OS === 'web') {
      const handleWebError = (e: ErrorEvent) => {
        showError({ error: e.error });
      };
      const handleWebRejection = (e: PromiseRejectionEvent) => {
        showError({ error: e.reason });
      };

      window.addEventListener('error', handleWebError);
      window.addEventListener('unhandledrejection', handleWebRejection);

      return () => {
        window.removeEventListener('error', handleWebError);
        window.removeEventListener('unhandledrejection', handleWebRejection);
      };
    } else {
      // React Native global error handler
      const defaultErrorHandler = (global as any).ErrorUtils?.getGlobalHandler?.();
      
      if ((global as any).ErrorUtils) {
        (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
          showError({ error });
          if (__DEV__ && defaultErrorHandler) {
            defaultErrorHandler(error, isFatal);
          }
        });
      }
      
      // Native Promise rejection tracking is usually handled by RN's rejection tracker,
      // but catching global errors covers fatal crashes.
    }
  }, []);

  const closeError = () => setIsOpen(false);

  return (
    <GlobalErrorContext.Provider value={{ showError }}>
      <GlobalErrorBoundary showError={showError}>
        {children}
      </GlobalErrorBoundary>
      
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={closeError} // Android back button support
      >
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sorry for the inconvenience</Text>
            <Text style={styles.modalDescription}>
              Something went wrong while processing your request.{"\n\n"}
              Please try again in a moment.{"\n"}
              If the problem continues, please restart the application or try again later.
            </Text>
            <Pressable style={styles.closeButton} onPress={closeError}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </GlobalErrorContext.Provider>
  );
};

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1E1E1E', // Dark mode respecting neutral background
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDescription: {
    color: '#A0A0A0',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  closeButton: {
    backgroundColor: '#333333',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
