"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Submodule, SubmoduleData } from "@/types/submodule";

export default function SubmodulesPage() {
  const [data, setData] = useState<SubmoduleData | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/submodules.json")
      .then((res) => res.json())
      .then((data: SubmoduleData) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load submodules:", err);
        setLoading(false);
      });
  }, []);

  const filteredSubmodules = data?.submodules.filter((sub) =>
    sub.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Submodule Inventory</h1>
        <p className="text-muted-foreground">
          Real-time status of all {data?.submodules.length || 0} registered submodules.
          Last updated: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "Unknown"}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search submodules..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {loading ? (
        <div>Loading submodule data...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSubmodules?.map((sub) => (
            <Card key={sub.path} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="truncate" title={sub.name}>
                    {sub.name}
                  </CardTitle>
                  <Badge
                    variant={
                      sub.status === "clean"
                        ? "default"
                        : sub.status === "modified"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {sub.status}
                  </Badge>
                </div>
                <CardDescription className="truncate" title={sub.path}>
                  {sub.path}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-2">
                <div className="text-sm">
                  <span className="font-semibold">Category: </span>
                  <span>{sub.category}</span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Role: </span>
                  <span>{sub.role}</span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Commit: </span>
                  <span className="font-mono">{sub.commit}</span>
                </div>
                <div className="text-sm truncate">
                  <a
                    href={sub.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    {sub.url}
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
