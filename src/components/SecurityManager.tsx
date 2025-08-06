import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Shield, Lock, Unlock, Eye, EyeOff, Trash2, RefreshCw } from 'lucide-react';
import { SecurityMigration, secureLog } from '../lib/security-migration.ts';
import { SecureApiKeyStorage, SecureDataStorage, SecureCacheManager } from '../lib/crypto-utils.ts';
import { useToast } from '../hooks/use-toast';

export function SecurityManager() {
  const [migrationStatus, setMigrationStatus] = useState(SecurityMigration.getMigrationStatus());
  const [isLoading, setIsLoading] = useState(false);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const { toast } = useToast();

  const handleMigration = async () => {
    setIsLoading(true);
    try {
      await SecurityMigration.migrateToSecureStorage();
      setMigrationStatus(SecurityMigration.getMigrationStatus());
      toast({
        title: "🔒 Security Migration Complete",
        description: "All sensitive data has been encrypted successfully.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "❌ Migration Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceRemigration = async () => {
    setIsLoading(true);
    try {
      await SecurityMigration.forceRemigration();
      setMigrationStatus(SecurityMigration.getMigrationStatus());
      toast({
        title: "🔄 Re-migration Complete",
        description: "All data has been re-encrypted successfully.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "❌ Re-migration Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAllData = async () => {
    if (!confirm('Are you sure you want to clear all encrypted data? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      SecureApiKeyStorage.clear();
      SecureDataStorage.clear();
      SecureCacheManager.clear();
      
      // Clear all localStorage
      localStorage.clear();
      
      setMigrationStatus(SecurityMigration.getMigrationStatus());
      toast({
        title: "🗑️ All Data Cleared",
        description: "All encrypted data has been cleared successfully.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "❌ Clear Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSecurityStatus = () => {
    if (migrationStatus.completed && !migrationStatus.hasUnencryptedData) {
      return { status: 'secure', icon: <Shield className="h-4 w-4" />, color: 'bg-green-500' };
    } else if (migrationStatus.completed && migrationStatus.hasUnencryptedData) {
      return { status: 'partial', icon: <Lock className="h-4 w-4" />, color: 'bg-yellow-500' };
    } else {
      return { status: 'insecure', icon: <Unlock className="h-4 w-4" />, color: 'bg-red-500' };
    }
  };

  const securityStatus = getSecurityStatus();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {securityStatus.icon}
            Security Status
          </CardTitle>
          <CardDescription>
            Manage encryption and security settings for sensitive data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Security Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${securityStatus.color}`} />
              <span className="font-medium">
                {securityStatus.status === 'secure' && 'Fully Encrypted'}
                {securityStatus.status === 'partial' && 'Partially Encrypted'}
                {securityStatus.status === 'insecure' && 'Unencrypted Data Found'}
              </span>
            </div>
            <Badge variant={securityStatus.status === 'secure' ? 'default' : 'destructive'}>
              {securityStatus.status.toUpperCase()}
            </Badge>
          </div>

          {/* Migration Status */}
          {!migrationStatus.completed && (
            <Alert>
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>Security migration is needed to encrypt sensitive data.</span>
                  <Button onClick={handleMigration} disabled={isLoading} size="sm">
                    {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Migrate Now'}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Unencrypted Data Warning */}
          {migrationStatus.hasUnencryptedData && (
            <Alert variant="destructive">
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>Found {migrationStatus.unencryptedKeys.length} unencrypted data items.</span>
                  <Button onClick={handleForceRemigration} disabled={isLoading} size="sm" variant="outline">
                    {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Re-encrypt'}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowSensitiveData(!showSensitiveData)}
              variant="outline"
              size="sm"
            >
              {showSensitiveData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showSensitiveData ? 'Hide' : 'Show'} Data Status
            </Button>
            
            <Button
              onClick={handleClearAllData}
              variant="destructive"
              size="sm"
            >
              <Trash2 className="h-4 w-4" />
              Clear All Data
            </Button>
          </div>

          {/* Data Status (when shown) */}
          {showSensitiveData && (
            <div className="space-y-2">
              <h4 className="font-medium">Data Status:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span>API Keys:</span>
                  <Badge variant="outline">
                    {Object.keys(SecureApiKeyStorage.getAll()).length} encrypted
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Library Data:</span>
                  <Badge variant="outline">
                    {SecureDataStorage.get('library_data') ? 'Encrypted' : 'None'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Cache Data:</span>
                  <Badge variant="outline">
                    {Object.keys(SecureCacheManager.getAll()).length} items
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Migration:</span>
                  <Badge variant={migrationStatus.completed ? 'default' : 'destructive'}>
                    {migrationStatus.completed ? 'Complete' : 'Pending'}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 