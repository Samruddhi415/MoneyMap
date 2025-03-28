// app/(main)/transaction/create/AddTransactionForm.jsx

"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2, Mic, MicOff } from "lucide-react";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import useFetch from "@/hooks/use-fetch";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CreateAccountDrawer } from "@/components/create-account-drawer";
import { cn } from "@/lib/utils";
import { createTransaction, updateTransaction } from "@/actions/transaction";
import { transactionSchema } from "@/app/lib/schema";
import { ReceiptScanner } from "@/app/(main)/transaction/_components/recipt-scanner"; // Adjusted import path

export function AddTransactionForm({
  accounts,
  categories,
  editMode = false,
  initialData = null,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit"); // This is fine as it is a client-side hook
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [recognition, setRecognition] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues,
    reset,
  } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues:
      editMode && initialData
        ? {
            type: initialData.type,
            amount: initialData.amount.toString(),
            description: initialData.description,
            accountId: initialData.accountId,
            category: initialData.category,
            date: new Date(initialData.date),
            isRecurring: initialData.isRecurring,
            ...(initialData.recurringInterval && {
              recurringInterval: initialData.recurringInterval,
            }),
          }
        : {
            type: "EXPENSE",
            amount: "",
            description: "",
            accountId: accounts.find((ac) => ac.isDefault)?.id,
            date: new Date(),
            isRecurring: false,
          },
  });

  const {
    loading: transactionLoading,
    fn: transactionFn,
    data: transactionResult,
  } = useFetch(editMode ? updateTransaction : createTransaction);

  const onSubmit = (data) => {
    const formData = {
      ...data,
      amount: parseFloat(data.amount),
    };

    if (editMode) {
      transactionFn(editId, formData);
    } else {
      transactionFn(formData);
    }
  };

  const handleScanComplete = (scannedData) => {
    if (scannedData) {
      setValue("amount", scannedData.amount.toString());
      setValue("date", new Date(scannedData.date));
      if (scannedData.description) {
        setValue("description", scannedData.description);
      }
      if (scannedData.category) {
        setValue("category", scannedData.category);
      }
      toast.success("Receipt scanned successfully");
    }
  };

  useEffect(() => {
    if (transactionResult?.success && !transactionLoading) {
      toast.success(
        editMode
          ? "Transaction updated successfully"
          : "Transaction created successfully"
      );
      reset();
      router.push(`/account/${transactionResult.data.accountId}`);
    }
  }, [transactionResult, transactionLoading, editMode, router, reset]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        
        recognitionInstance.onstart = () => {
          setVoiceStatus("Listening...");
          setIsListening(true);
        };
        
        recognitionInstance.onend = () => {
          setVoiceStatus("");
          setIsListening(false);
        };
        
        recognitionInstance.onerror = (event) => {
          console.error("Speech recognition error", event.error);
          setVoiceStatus(`Error: ${event.error}`);
          setIsListening(false);
        };
        
        recognitionInstance.onresult = (event) => {
          const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
          setVoiceStatus(`I heard: ${transcript}`);
          
          // Process voice commands
          processVoiceCommand(transcript);
        };
        
        setRecognition(recognitionInstance);
      } else {
        setVoiceStatus("Speech recognition not supported by your browser");
      }
    }
    
    // Cleanup
    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, []);

  const processVoiceCommand = (transcript) => {
    // Type commands
    if (transcript.includes("expense") || transcript.includes("spending")) {
      setValue("type", "EXPENSE");
      toast.success("Set type to Expense");
    } else if (transcript.includes("income") || transcript.includes("earning")) {
      setValue("type", "INCOME");
      toast.success("Set type to Income");
    }
    
    // Amount commands
    const amountMatch = transcript.match(/amount (\d+(\.\d+)?)|(\d+(\.\d+)?) dollars/);
    if (amountMatch) {
      const amount = amountMatch[1] || amountMatch[3];
      setValue("amount", amount);
      toast.success(`Set amount to ${amount}`);
    }
    
    // Date commands
    if (transcript.includes("today")) {
      setValue("date", new Date());
      toast.success("Set date to today");
    } else if (transcript.includes("yesterday")) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      setValue("date", yesterday);
      toast.success("Set date to yesterday");
    }
    
    // Description commands
    const descriptionMatch = transcript.match(/description (.+?)($|\s(amount|type|account|category|date))/);
    if (descriptionMatch) {
      setValue("description", descriptionMatch[1].trim());
      toast.success(`Set description to ${descriptionMatch[1].trim()}`);
    }
    
    // Category commands
    for (const category of categories) {
      if (transcript.includes(`category ${category.name.toLowerCase()}`)) {
        setValue("category", category.id);
        toast.success(`Set category to ${category.name}`);
        break;
      }
    }
    
    // Account commands
    for (const account of accounts) {
      if (transcript.includes(`account ${account.name.toLowerCase()}`)) {
        setValue("accountId", account.id);
        toast.success(`Set account to ${account.name}`);
        break;
      }
    }
    
    // Recurring commands
    if (transcript.includes("recurring yes") || transcript.includes("set recurring")) {
      setValue("isRecurring", true);
      toast.success("Enabled recurring transaction");
    } else if (transcript.includes("recurring no") || transcript.includes("not recurring")) {
      setValue("isRecurring", false);
      toast.success("Disabled recurring transaction");
    }
    
    // Recurring interval commands
    if (transcript.includes("daily")) {
      setValue("recurringInterval", "DAILY");
      toast.success("Set recurring interval to daily");
    } else if (transcript.includes("weekly")) {
      setValue("recurringInterval", "WEEKLY");
      toast.success("Set recurring interval to weekly");
    } else if (transcript.includes("monthly")) {
      setValue("recurringInterval", "MONTHLY");
      toast.success("Set recurring interval to monthly");
    } else if (transcript.includes("yearly")) {
      setValue("recurringInterval", "YEARLY");
      toast.success("Set recurring interval to yearly");
    }
    
    // Submit command
    if (transcript.includes("submit") || transcript.includes("save transaction")) {
      handleSubmit(onSubmit)();
      toast.success("Submitting form...");
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognition?.stop();
    } else {
      recognition?.start();
    }
  };

  const type = watch("type");
  const isRecurring = watch("isRecurring");
  const date = watch("date");

  const filteredCategories = categories.filter(
    (category) => category.type === type
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Voice Input Feature */}
      <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/50">
        <div className="space-y-0.5">
          <label className="text-base font-medium">Voice Input</label>
          <div className="text-sm text-muted-foreground">
            {voiceStatus || "Use voice commands to fill this form"}
          </div>
        </div>
        <Button
          type="button"
          variant={isListening ? "destructive" : "secondary"}
          size="icon"
          onClick={toggleListening}
          className="h-10 w-10"
        >
          {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
      </div>

      {/* Receipt Scanner - Only show in create mode */}
      {!editMode && <ReceiptScanner onScanComplete={handleScanComplete} />}

      {/* Type */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Type</label>
        <Select
          onValueChange={(value) => setValue("type", value)}
          defaultValue={type}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EXPENSE">Expense</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-sm text-red-500">{errors.type.message}</p>
        )}
      </div>

      {/* Amount and Account */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Amount</label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("amount")}
          />
          {errors.amount && (
            <p className="text-sm text-red-500">{errors.amount.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Account</label>
          <Select
            onValueChange={(value) => setValue("accountId", value)}
            defaultValue={getValues("accountId")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} (${parseFloat(account.balance).toFixed(2)})
                </SelectItem>
              ))}
              <CreateAccountDrawer>
                <Button
                  variant="ghost"
                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  Create Account
                </Button>
              </CreateAccountDrawer>
            </SelectContent>
          </Select>
          {errors.accountId && (
            <p className="text-sm text-red-500">{errors.accountId.message}</p>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Category</label>
        <Select
          onValueChange={(value) => setValue("category", value)}
          defaultValue={getValues("category")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && (
          <p className="text-sm text-red-500">{errors.category.message}</p>
        )}
      </div>

      {/* Date */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full pl-3 text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              {date ? format(date, "PPP") : <span>Pick a date</span>}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(date) => setValue("date", date)}
              disabled={(date) =>
                date > new Date() || date < new Date("1900-01-01")
              }
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {errors.date && (
          <p className="text-sm text-red-500">{errors.date.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Input placeholder="Enter description" {...register("description")} />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      {/* Recurring Toggle */}
      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <label className="text-base font-medium">Recurring Transaction</label>
          <div className="text-sm text-muted-foreground">
            Set up a recurring schedule for this transaction
          </div>
        </div>
        <Switch
          checked={isRecurring}
          onCheckedChange={(checked) => setValue("isRecurring", checked)}
        />
      </div>

      {/* Recurring Interval */}
      {isRecurring && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Recurring Interval</label>
          <Select
            onValueChange={(value) => setValue("recurringInterval", value)}
            defaultValue={getValues("recurringInterval")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
          {errors.recurringInterval && (
            <p className="text-sm text-red-500">
              {errors.recurringInterval.message}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" className="w-full" disabled={transactionLoading}>
          {transactionLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {editMode ? "Updating..." : "Creating..."}
            </>
          ) : editMode ? (
            "Update Transaction"
          ) : (
            "Create Transaction"
          )}
        </Button>
      </div>

      {/* Voice Command Help */}
      <div className="mt-8 p-4 border rounded-lg bg-muted/30">
        <h3 className="text-lg font-medium mb-2">Voice Command Examples:</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>- "Type expense" or "Type income"</li>
          <li>- "Amount 50" or "50 dollars"</li>
          <li>- "Description lunch with clients"</li>
          <li>- "Category [category name]"</li>
          <li>- "Account [account name]"</li>
          <li>- "Today" or "Yesterday" for date</li>
          <li>- "Set recurring" or "Not recurring"</li>
          <li>- "Daily", "Weekly", "Monthly", or "Yearly" for recurring interval</li>
          <li>- "Submit" or "Save transaction" to save</li>
        </ul>
      </div>
    </form>
  );
}