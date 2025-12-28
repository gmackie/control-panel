"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  MoreVertical, 
  Key, 
  RefreshCw, 
  AlertTriangle,
  Clock,
  Shield
} from "lucide-react";
import { Secret } from "@/types";
import { formatDistanceToNow } from "date-fns";

export function SecretsList() {
  const [selectedNamespace, setSelectedNamespace] = useState<string>("all");
  
  const { data: secrets = [], isLoading } = useQuery<Secret[]>({
    queryKey: ["secrets", selectedNamespace],
    queryFn: async () => {
      const response = await fetch("/api/secrets");
      if (!response.ok) throw new Error("Failed to fetch secrets");
      const data = await response.json();
      
      if (selectedNamespace === "all") return data;
      return data.filter((secret: Secret) => secret.namespace === selectedNamespace);
    },
    refetchInterval: 30000,
  });

  const namespaces = Array.from(new Set(secrets.map(s => s.namespace)));
  
  const getSecretStatus = (secret: Secret) => {
    if (secret.expiresAt) {
      const expiryDate = new Date(secret.expiresAt);
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < 0) return { status: "expired", color: "destructive" };
      if (daysUntilExpiry < 7) return { status: "expiring-soon", color: "warning" };
    }
    
    if (secret.lastRotated) {
      const lastRotatedDate = new Date(secret.lastRotated);
      const daysSinceRotation = Math.floor((Date.now() - lastRotatedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceRotation > 90) return { status: "needs-rotation", color: "warning" };
    }
    
    return { status: "healthy", color: "success" };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">
            <Shield className="h-3 w-3 mr-1" />
            {secrets.length} Secrets
          </Badge>
          <select
            value={selectedNamespace}
            onChange={(e) => setSelectedNamespace(e.target.value)}
            className="text-sm border rounded-md px-3 py-1"
          >
            <option value="all">All Namespaces</option>
            {namespaces.map(ns => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
        </div>
        <Button size="sm">
          <Key className="h-4 w-4 mr-2" />
          Add Secret
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Namespace</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Keys</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Rotated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {secrets.map((secret) => {
              const { status, color } = getSecretStatus(secret);
              
              return (
                <TableRow key={`${secret.namespace}-${secret.name}`}>
                  <TableCell className="font-medium">{secret.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{secret.namespace}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {secret.type}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {secret.keys.slice(0, 3).map(key => (
                        <Badge key={key} variant="secondary" className="text-xs">
                          {key}
                        </Badge>
                      ))}
                      {secret.keys.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{secret.keys.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={color as any}>
                      {status === "expired" && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {status === "expiring-soon" && <Clock className="h-3 w-3 mr-1" />}
                      {status.replace("-", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {secret.lastRotated
                      ? formatDistanceToNow(new Date(secret.lastRotated), { addSuffix: true })
                      : "Never"
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Rotate Secret
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Key className="h-4 w-4 mr-2" />
                          View Keys
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}