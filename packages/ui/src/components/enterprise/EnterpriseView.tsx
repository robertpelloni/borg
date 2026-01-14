"use client";

import React from 'react';
import { WorkflowDesigner } from "@/components/designer/WorkflowDesigner";
import { AuditLogViewer } from "@/components/enterprise/AuditLogViewer";
import { RbacManager } from "@/components/enterprise/RbacManager";
import { NodeManager } from "@/components/enterprise/NodeManager";
import { OidcConfig } from "@/components/enterprise/OidcConfig";
import { Marketplace } from "@/components/enterprise/Marketplace";
import { ToolInventory } from "@/components/enterprise/ToolInventory";
import { A2AMesh } from "@/components/enterprise/A2AMesh";
import { DataResidencyConfig } from "@/components/enterprise/DataResidencyConfig";
import { GpuDashboard } from "@/components/enterprise/GpuDashboard";
import { InfrastructureDashboard } from "@/components/enterprise/InfrastructureDashboard";
import { TrafficInspector } from "@/components/enterprise/TrafficInspector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Workflow, History, Users, ShoppingBag, Network, Database, Cpu, Server } from "lucide-react";

export function EnterpriseView() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">System Compliance</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">98.2%</div>
            <p className="text-xs text-slate-500">+2.1% from last month</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Active Policies</CardTitle>
            <Workflow className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">12</div>
            <p className="text-xs text-slate-500">3 modified today</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Audit Events</CardTitle>
            <History className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">1,284</div>
            <p className="text-xs text-slate-500">Past 24 hours</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Active Users</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">45</div>
            <p className="text-xs text-slate-500">12 active now</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="designer" className="space-y-4">
        <TabsList className="bg-slate-900 border-slate-800 p-1 overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="designer" className="data-[state=active]:bg-slate-800">Workflow Designer</TabsTrigger>
          <TabsTrigger value="inventory" className="data-[state=active]:bg-slate-800">Tool Inventory</TabsTrigger>
          <TabsTrigger value="marketplace" className="data-[state=active]:bg-slate-800">Marketplace</TabsTrigger>
          <TabsTrigger value="audit" className="data-[state=active]:bg-slate-800">Audit Trail</TabsTrigger>
          <TabsTrigger value="rbac" className="data-[state=active]:bg-slate-800">Access Control</TabsTrigger>
          <TabsTrigger value="nodes" className="data-[state=active]:bg-slate-800">Distributed Nodes</TabsTrigger>
          <TabsTrigger value="a2a" className="data-[state=active]:bg-slate-800">A2A Mesh</TabsTrigger>
          <TabsTrigger value="residency" className="data-[state=active]:bg-slate-800">Data Residency</TabsTrigger>
          <TabsTrigger value="gpu" className="data-[state=active]:bg-slate-800">GPU Acceleration</TabsTrigger>
          <TabsTrigger value="infra" className="data-[state=active]:bg-slate-800 flex items-center gap-1.5 text-blue-400">
            <Server className="h-3.5 w-3.5" />
            Infrastructure
          </TabsTrigger>
          <TabsTrigger value="traffic" className="data-[state=active]:bg-slate-800">Traffic Inspector</TabsTrigger>
          <TabsTrigger value="governance" className="data-[state=active]:bg-slate-800">SSO & Governance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="designer" className="space-y-4">
          <Card className="bg-slate-950 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-50">Visual Agent Workflow Designer</CardTitle>
              <CardDescription className="text-slate-400">
                Design complex autonomous agent pipelines with visual drag-and-drop.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkflowDesigner />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marketplace">
          <Marketplace />
        </TabsContent>
        
        <TabsContent value="audit">
          <AuditLogViewer />
        </TabsContent>
        
        <TabsContent value="rbac">
          <RbacManager />
        </TabsContent>

        <TabsContent value="nodes">
          <NodeManager />
        </TabsContent>

        <TabsContent value="a2a">
          <A2AMesh />
        </TabsContent>

        <TabsContent value="residency">
          <DataResidencyConfig />
        </TabsContent>

        <TabsContent value="gpu">
          <GpuDashboard />
        </TabsContent>

        <TabsContent value="infra">
          <InfrastructureDashboard />
        </TabsContent>

        <TabsContent value="traffic">
          <TrafficInspector />
        </TabsContent>

        <TabsContent value="governance">
          <OidcConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
